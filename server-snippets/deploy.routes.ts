// ============================================================
// AXONETIS™ Builder — REAL DEPLOY PIPELINE (publish.run)
// Target Hetzner path:
//   /opt/hostflow-ecosystem/hostflow-server/src/routes/deploy.routes.ts
//
// Mount in server entry (NO DUPLICATE router):
//   import deployRouter from "./routes/deploy.routes.js";
//   app.use("/rpc", deployRouter);
//
// Frontend contract (src/lib/publish-api.ts → runPublish):
//   POST /rpc/publish.run           → SSE log stream (step/log/done/error)
//   GET  /rpc/publish.lastRun       → last run summary + tail
//
// Pipeline per project (real, no dummy):
//   1. sandbox → production promote  (project_files env copy in Supabase 3)
//   2. git pull                       (repo dir)
//   3. bun install
//   4. bun run build
//   5. migrations apply               (sql/ dir, psql, idempotent)
//   6. pm2 reload <process>
//   7. health probe                   (http url)
//   8. deployments + publish_settings rows updated
// ============================================================

import { Router, type Request, type Response } from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { supabase3 as supabase } from "../integrations/supabase3/client.js";

const router = Router();

type Target = {
  repo: string;
  pm2: string;
  url: string;
  /** optional sql dir for migrations (relative to repo) */
  sqlDir?: string;
  /** env var holding the psql connection string for this project */
  dbUrlEnv?: string;
};

const TARGETS: Record<string, Target> = {
  founderbuilder: {
    repo: "/var/www/axonetis",
    pm2: "axonetis-builder",
    url: "https://founderbuilder.axonetis.com",
    sqlDir: "sql/founder",
    dbUrlEnv: "AXONETIS_DB_URL",
  },
  hostflowai: {
    repo: "/var/www/hostflowai",
    pm2: "hostflow-server",
    url: "https://nexatect.com",
    sqlDir: "sql",
    dbUrlEnv: "SUPABASE1_DB_URL",
  },
  anexomail: {
    repo: "/var/www/anexomail",
    pm2: "anexomail-web",
    url: "https://founderworkspace.anexomail.com",
  },
  anexvotaipay: {
    repo: "/var/www/anexvot-ai-pay",
    pm2: "anexvot-pay",
    url: "https://anexvotpay.com",
    sqlDir: "sql",
    dbUrlEnv: "SUPABASE2_DB_URL",
  },
};
TARGETS.rapidpay = TARGETS.anexvotaipay;

const LAST_RUN = new Map<string, { runId: string; ok: boolean; at: string; tail: string[] }>();

function sse(res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const ping = setInterval(() => res.write(`event: ping\ndata: {}\n\n`), 10_000);
  res.on("close", () => clearInterval(ping));
  return { send, stop: () => clearInterval(ping) };
}

function run(
  cmd: string,
  args: string[],
  cwd: string,
  onLine: (line: string) => void,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, shell: false });
    const feed = (buf: Buffer) => {
      for (const line of buf.toString().split(/\r?\n/)) if (line.trim()) onLine(line);
    };
    child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    child.on("error", (e) => {
      onLine(`spawn error: ${e.message}`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/** sandbox → production promote inside Supabase 3 project_files. */
async function promoteFiles(projectId: string, log: (l: string) => void) {
  const { data, error } = await supabase
    .from("project_files")
    .select("path, content, env")
    .eq("project_id", projectId)
    .eq("env", "sandbox");
  if (error) throw new Error(`promote read failed: ${error.message}`);
  const rows = data ?? [];
  if (rows.length === 0) {
    log("sandbox mein koi pending file nahi — repo state hi promote hogi.");
    return 0;
  }
  const payload = rows.map((r) => ({
    project_id: projectId,
    path: r.path,
    content: r.content,
    env: "production",
  }));
  const { error: upErr } = await supabase
    .from("project_files")
    .upsert(payload, { onConflict: "project_id,path,env" });
  if (upErr) throw new Error(`promote write failed: ${upErr.message}`);
  log(`${rows.length} files sandbox → production promote ho gayi.`);
  return rows.length;
}

async function applyMigrations(
  target: Target,
  log: (l: string) => void,
): Promise<{ applied: number; failed: number }> {
  if (!target.sqlDir) return { applied: 0, failed: 0 };
  const dbUrl = target.dbUrlEnv ? process.env[target.dbUrlEnv] : undefined;
  if (!dbUrl) {
    log(`migrations skip — ${target.dbUrlEnv ?? "DB URL"} env set nahi hai.`);
    return { applied: 0, failed: 0 };
  }
  const dir = path.join(target.repo, target.sqlDir);
  if (!existsSync(dir)) {
    log(`migrations skip — ${dir} maujood nahi.`);
    return { applied: 0, failed: 0 };
  }
  const files: string[] = [];
  const walk = async (d: string) => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith(".sql") && !entry.name.startsWith("VERIFY")) files.push(p);
    }
  };
  await walk(dir);
  files.sort();
  let applied = 0;
  let failed = 0;
  for (const file of files) {
    const code = await run(
      "psql",
      [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", file],
      target.repo,
      (l) => log(`psql: ${l}`),
    );
    if (code === 0) {
      applied += 1;
      log(`migration ok → ${path.relative(target.repo, file)}`);
    } else {
      failed += 1;
      log(`migration FAILED → ${path.relative(target.repo, file)}`);
    }
  }
  return { applied, failed };
}

async function probe(url: string, log: (l: string) => void) {
  try {
    const r = await fetch(url, { method: "GET", redirect: "manual" });
    log(`health probe ${url} → ${r.status}`);
    return r.status < 500;
  } catch (e) {
    log(`health probe failed: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

async function recordDeployment(
  projectId: string,
  runId: string,
  patch: Record<string, unknown>,
) {
  await supabase
    .from("deployments")
    .upsert(
      { id: runId, project_slug: projectId, ...patch },
      { onConflict: "id" },
    )
    .then(
      () => undefined,
      () => undefined,
    );
}

router.post("/publish.run", async (req: Request, res: Response) => {
  const projectId = String(req.body?.projectId ?? "").trim();
  const branch = String(req.body?.branch ?? "main").trim() || "main";
  const target = TARGETS[projectId];
  const { send, stop } = sse(res);
  const runId = randomUUID();
  const tail: string[] = [];
  const log = (line: string) => {
    tail.push(line);
    if (tail.length > 500) tail.shift();
    send("log", { line, at: Date.now() });
  };
  const step = (id: string, status: "running" | "ok" | "error", label: string) =>
    send("step", { id, status, label, at: Date.now() });

  if (!target) {
    send("error", { message: `unknown projectId "${projectId}"` });
    stop();
    return res.end();
  }

  send("start", { runId, projectId, branch, repo: target.repo, pm2: target.pm2, url: target.url });
  await recordDeployment(projectId, runId, {
    status: "deploying",
    started_at: new Date().toISOString(),
    url: target.url,
  });

  let ok = true;
  try {
    // 1. promote
    step("promote", "running", "Promote sandbox → production");
    const promoted = await promoteFiles(projectId, log);
    step("promote", "ok", `Promoted ${promoted} file(s)`);

    // 2. git pull
    step("git", "running", "git pull");
    await run("git", ["fetch", "--all", "--prune"], target.repo, log);
    await run("git", ["checkout", "--", "src/routeTree.gen.ts"], target.repo, () => {});
    const gitCode = await run("git", ["pull", "--ff-only", "origin", branch], target.repo, log);
    step("git", gitCode === 0 ? "ok" : "error", gitCode === 0 ? "Repo up to date" : "git pull failed");
    if (gitCode !== 0) throw new Error("git pull failed");

    // 3. install
    step("install", "running", "bun install");
    const installCode = await run("bun", ["install"], target.repo, log);
    step("install", installCode === 0 ? "ok" : "error", "Dependencies");
    if (installCode !== 0) throw new Error("bun install failed");

    // 4. build
    step("build", "running", "bun run build");
    const buildCode = await run("bun", ["run", "build"], target.repo, log);
    step("build", buildCode === 0 ? "ok" : "error", "Build");
    if (buildCode !== 0) throw new Error("build failed");

    // 5. migrations
    step("migrate", "running", "Apply migrations");
    const mig = await applyMigrations(target, log);
    step(
      "migrate",
      mig.failed === 0 ? "ok" : "error",
      `Migrations ${mig.applied} applied${mig.failed ? `, ${mig.failed} failed` : ""}`,
    );
    if (mig.failed > 0) throw new Error("migration failed");

    // 6. PM2 restart — never run `pm2 update` or mutate the production daemon.
    step("reload", "running", `pm2 restart ${target.pm2}`);
    const reloadCode = await run("pm2", ["restart", target.pm2], target.repo, log);
    step("reload", reloadCode === 0 ? "ok" : "error", "Process restarted");
    if (reloadCode !== 0) throw new Error("pm2 restart failed");

    // 7. health
    step("health", "running", "Health probe");
    await new Promise((r) => setTimeout(r, 2500));
    const healthy = await probe(target.url, log);
    step("health", healthy ? "ok" : "error", healthy ? "Live" : "Health probe failed");
    if (!healthy) throw new Error("health probe failed");
  } catch (err) {
    ok = false;
    const message = err instanceof Error ? err.message : String(err);
    log(`DEPLOY FAILED: ${message}`);
    send("error", { message, runId });
  }

  await recordDeployment(projectId, runId, {
    status: ok ? "live" : "failed",
    finished_at: new Date().toISOString(),
    url: target.url,
  });
  if (ok) {
    await supabase
      .from("publish_settings")
      .upsert(
        {
          project_slug: projectId,
          last_published_at: new Date().toISOString(),
          unpublished_at: null,
        },
        { onConflict: "project_slug" },
      )
      .then(
        () => undefined,
        () => undefined,
      );
  }

  LAST_RUN.set(projectId, { runId, ok, at: new Date().toISOString(), tail: tail.slice(-120) });
  send("done", { runId, ok, url: target.url, at: Date.now() });
  stop();
  res.end();
});

router.get("/publish.lastRun", (req: Request, res: Response) => {
  const projectId = String(req.query.projectId ?? "").trim();
  return res.json(LAST_RUN.get(projectId) ?? null);
});

export default router;
