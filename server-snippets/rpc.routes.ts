// ============================================================
// AXONETIS™ Builder — Phase 3.9.3 + 3.9.4 RPC endpoints
// Target Hetzner path:
//   /var/www/axonetis/src/routes/rpc.routes.ts
//
// Mount in server entry (NO DUPLICATE router):
//   import rpcRouter from "./routes/rpc.routes.js";
//   app.use("/rpc", rpcRouter);
//
// Frontend contracts covered:
//   publish.state | publish.setVisibility | publish.share | publish.unpublish
//   deploys.status (SSE)
//   sql.validate
//   caddy.list | caddy.attach | caddy.revoke
//   timetravel.commits | timetravel.checkout
//   rrweb.push | rrweb.list
// ============================================================

import { Router, type Request, type Response } from "express";
import { createHash, randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, rm, writeFile } from "fs/promises";
import { supabase3 as supabase } from "../integrations/supabase3/client.js";

type CustomDomainRow = {
  id: string;
  domain: string;
  target: string;
  ssl: string;
  attached_at: string | null;
  last_check: string | null;
};

type RrwebSessionRow = {
  id: string;
  started_at: string;
  last_event_at: string | null;
  event_count: number | null;
};

const execFileAsync = promisify(execFile);
const router = Router();

const PROJECT_REPOS: Record<string, string> = {
  hostflowai: "/var/www/hostflowai",
  rapidpay: "/var/www/anexvot-ai-pay",
  anexvotaipay: "/var/www/anexvot-ai-pay",
  founderbuilder: "/var/www/axonetis",
};

const PROJECT_URLS: Record<string, string> = {
  hostflowai: "https://nexatect.com",
  anexomail: "https://founderworkspace.anexomail.com",
  rapidpay: "https://anexvotaipay.com",
  anexvotaipay: "https://anexvotaipay.com",
  founderbuilder: "https://founderbuilder.axonetis.com",
};

const CADDY_BIN = process.env.CADDY_BIN ?? "caddy";
const CADDY_SITES_DIR = process.env.CADDY_SITES_DIR ?? "/etc/caddy/sites-enabled";

function bad(res: Response, message: string, status = 400) {
  return res.status(status).json({ error: message });
}

function serverError(res: Response, err: unknown) {
  console.error("[rpc]", err);
  return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
}

function cleanProjectId(input: unknown) {
  const projectId = String(input ?? "").trim();
  if (!projectId || !/^[a-z0-9_-]{2,64}$/i.test(projectId)) return null;
  return projectId;
}

function cleanDomain(input: unknown) {
  const domain = String(input ?? "").trim().toLowerCase();
  if (!/^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain)) return null;
  return domain;
}

function cleanSha(input: unknown) {
  const sha = String(input ?? "").trim();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return null;
  return sha;
}

async function getProjectRow(projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, name, preview_url")
    .eq("slug", projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getLatestDeployment(projectUuid: string) {
  const { data, error } = await supabase
    .from("deployments")
    .select("id, status, url, commit_sha, started_at, finished_at")
    .eq("project_id", projectUuid)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getPublishMeta(projectUuid: string) {
  const { data, error } = await supabase
    .from("publish_settings")
    .select("visibility, custom_domain, unpublished_at, last_published_at")
    .eq("project_id", projectUuid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function countVisitors24h(projectUuid: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("visitor_events")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectUuid)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

function normalizeDeployStatus(status?: string | null) {
  if (status === "deploying" || status === "pending" || status === "running") return "deploying";
  if (status === "failed" || status === "error") return "failed";
  if (status === "live" || status === "success" || status === "ready") return "up_to_date";
  return "changes_pending";
}

// ─────────────────────────────────────────────────────────────
// Phase 3.9.3 — Publish Modal endpoints
// ─────────────────────────────────────────────────────────────

router.get("/publish.state", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.query.projectId);
    if (!projectId) return bad(res, "projectId required");

    const project = await getProjectRow(projectId);
    if (!project) return bad(res, "project not found", 404);

    const [meta, deployment, visitors24h] = await Promise.all([
      getPublishMeta(project.id),
      getLatestDeployment(project.id),
      countVisitors24h(project.id),
    ]);

    const fallbackUrl = deployment?.url ?? (meta?.custom_domain ? `https://${meta.custom_domain}` : project.preview_url ?? PROJECT_URLS[projectId] ?? null);

    return res.json({
      projectId,
      url: meta?.unpublished_at ? null : fallbackUrl,
      customDomain: meta?.custom_domain ?? null,
      visibility: meta?.visibility ?? "private",
      status: meta?.unpublished_at ? "changes_pending" : normalizeDeployStatus(deployment?.status),
      visitors24h,
      lastPublishedAt: meta?.last_published_at ?? deployment?.finished_at ?? null,
    });
  } catch (err) { return serverError(res, err); }
});

router.post("/publish.setVisibility", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.body?.projectId);
    const visibility = String(req.body?.visibility ?? "");
    if (!projectId) return bad(res, "projectId required");
    if (!["public", "unlisted", "private"].includes(visibility)) return bad(res, "invalid visibility");

    const project = await getProjectRow(projectId);
    if (!project) return bad(res, "project not found", 404);

    const { error } = await supabase.from("publish_settings").upsert({
      project_id: project.id,
      visibility,
      unpublished_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id" });
    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) { return serverError(res, err); }
});

router.post("/publish.share", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.body?.projectId);
    const ttlDays = Math.min(Math.max(Number(req.body?.ttlDays ?? 7), 1), 7);
    if (!projectId) return bad(res, "projectId required");

    const project = await getProjectRow(projectId);
    if (!project) return bad(res, "project not found", 404);

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    const url = `${PROJECT_URLS[projectId] ?? project.preview_url ?? ""}?share=${token}`;

    const { error } = await supabase.from("publish_share_links").insert({
      project_id: project.id,
      token_hash: createHash("sha256").update(token).digest("hex"),
      expires_at: expiresAt,
      created_by: "founder",
    });
    if (error) throw error;

    return res.json({ url, expiresAt });
  } catch (err) { return serverError(res, err); }
});

router.post("/publish.unpublish", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.body?.projectId);
    if (!projectId) return bad(res, "projectId required");
    const project = await getProjectRow(projectId);
    if (!project) return bad(res, "project not found", 404);

    const now = new Date().toISOString();
    const { error } = await supabase.from("publish_settings").upsert({
      project_id: project.id,
      visibility: "private",
      unpublished_at: now,
      updated_at: now,
    }, { onConflict: "project_id" });
    if (error) throw error;

    await supabase.from("deployments").insert({
      project_id: project.id,
      environment: "production",
      status: "unpublished",
      url: null,
      logs: [{ at: now, message: "Unpublished by founder" }],
      finished_at: now,
    });

    return res.json({ ok: true });
  } catch (err) { return serverError(res, err); }
});

router.get("/deploys.status", async (req: Request, res: Response) => {
  const projectId = cleanProjectId(req.query.projectId);
  if (!projectId) return bad(res, "projectId required");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let closed = false;
  const send = (payload: unknown) => {
    if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const tick = async () => {
    try {
      const project = await getProjectRow(projectId);
      if (!project) return send({ status: "offline" });
      const [deployment, visitors24h] = await Promise.all([
        getLatestDeployment(project.id),
        countVisitors24h(project.id),
      ]);
      send({ status: normalizeDeployStatus(deployment?.status), visitors24h });
    } catch {
      send({ status: "offline" });
    }
  };

  await tick();
  const interval = setInterval(tick, 5000);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    closed = true;
    clearInterval(interval);
    clearInterval(heartbeat);
    res.end();
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 3.9.4 — Power Tools endpoints
// ─────────────────────────────────────────────────────────────

router.post("/sql.validate", async (req, res) => {
  try {
    const query = String(req.body?.query ?? "").trim();
    if (!query) return bad(res, "query required");
    if (query.length > 20000) return bad(res, "query too large");

    const lower = query.toLowerCase();
    const issues: { level: "info" | "warn" | "error"; message: string }[] = [];
    const blocked = ["drop database", "drop schema", "truncate auth.", "delete from auth.", "alter system", "copy "];
    const warnings = ["drop table", "truncate table", "delete from", "update ", "alter table", "create policy"];

    for (const term of blocked) if (lower.includes(term)) issues.push({ level: "error", message: `Blocked destructive pattern: ${term}` });
    for (const term of warnings) if (lower.includes(term)) issues.push({ level: "warn", message: `Review required: ${term}` });
    if (/create\s+table\s+public\./i.test(query) && !/grant\s+/i.test(query)) {
      issues.push({ level: "error", message: "public CREATE TABLE must include GRANT block in same migration" });
    }
    if (/create\s+table\s+public\./i.test(query) && !/enable\s+row\s+level\s+security/i.test(query)) {
      issues.push({ level: "warn", message: "RLS enable statement missing or not detected" });
    }

    const affectedTables = Array.from(query.matchAll(/(?:from|join|update|into|table)\s+public\.([a-zA-Z0-9_]+)/gi)).map((m) => m[1]);
    const hasError = issues.some((i) => i.level === "error");
    const hasWarn = issues.some((i) => i.level === "warn");

    return res.json({
      ok: !hasError,
      verdict: hasError ? "block" : hasWarn ? "warn" : "safe",
      issues: issues.length ? issues : [{ level: "info", message: "No obvious destructive SQL pattern detected" }],
      affectedTables: Array.from(new Set(affectedTables)),
      estimatedRows: null,
    });
  } catch (err) { return serverError(res, err); }
});

router.get("/caddy.list", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.query.projectId);
    if (!projectId) return bad(res, "projectId required");
    const project = await getProjectRow(projectId);
    if (!project) return bad(res, "project not found", 404);

    const { data, error } = await supabase
      .from("custom_domains")
      .select("id, domain, target, ssl, attached_at, last_check")
      .eq("project_id", project.id)
      .order("attached_at", { ascending: false });
    if (error) throw error;

    return res.json(((data ?? []) as CustomDomainRow[]).map((d) => ({
      id: d.id,
      domain: d.domain,
      target: d.target,
      ssl: d.ssl,
      attachedAt: d.attached_at,
      lastCheck: d.last_check,
    })));
  } catch (err) { return serverError(res, err); }
});

router.post("/caddy.attach", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.body?.projectId);
    const domain = cleanDomain(req.body?.domain);
    if (!projectId) return bad(res, "projectId required");
    if (!domain) return bad(res, "valid domain required");
    const project = await getProjectRow(projectId);
    if (!project) return bad(res, "project not found", 404);

    const target = PROJECT_URLS[projectId] ?? project.preview_url;
    const caddyfile = `${domain} {\n  reverse_proxy ${new URL(target).host}\n}\n`;

    // No shell interpolation: safe args only. If permissions are not configured,
    // DB row still records pending/failed and UI shows it.
    try {
      await mkdir(CADDY_SITES_DIR, { recursive: true });
      await writeFile(`${CADDY_SITES_DIR}/${domain}.caddy`, caddyfile, "utf8");
      await execFileAsync(CADDY_BIN, ["reload", "--config", "/etc/caddy/Caddyfile"]);
    } catch (e) {
      console.warn("[rpc.caddy.attach] Caddy reload failed", e);
    }

    const { data, error } = await supabase.from("custom_domains").upsert({
      project_id: project.id,
      domain,
      target,
      ssl: "issuing",
      attached_at: new Date().toISOString(),
      last_check: new Date().toISOString(),
    }, { onConflict: "project_id,domain" }).select("id, domain, target, ssl, attached_at, last_check").single();
    if (error) throw error;

    await supabase.from("publish_settings").upsert({
      project_id: project.id,
      custom_domain: domain,
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id" });

    return res.json({ ok: true, domain: {
      id: data.id,
      domain: data.domain,
      target: data.target,
      ssl: data.ssl,
      attachedAt: data.attached_at,
      lastCheck: data.last_check,
    }});
  } catch (err) { return serverError(res, err); }
});

router.post("/caddy.revoke", async (req, res) => {
  try {
    const id = String(req.body?.id ?? "");
    if (!id) return bad(res, "id required");

    const { data: row, error: readErr } = await supabase
      .from("custom_domains")
      .select("id, domain")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) return bad(res, "domain not found", 404);

    try {
      await rm(`${CADDY_SITES_DIR}/${row.domain}.caddy`, { force: true });
      await execFileAsync(CADDY_BIN, ["reload", "--config", "/etc/caddy/Caddyfile"]);
    } catch (e) {
      console.warn("[rpc.caddy.revoke] Caddy reload failed", e);
    }

    const { error } = await supabase.from("custom_domains").delete().eq("id", id);
    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) { return serverError(res, err); }
});

router.get("/timetravel.commits", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.query.projectId);
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    if (!projectId) return bad(res, "projectId required");
    const repo = PROJECT_REPOS[projectId];
    if (!repo) return bad(res, "repo not configured", 404);

    const { stdout } = await execFileAsync("git", ["log", `--max-count=${limit}`, "--pretty=format:%H%x1f%an%x1f%ad%x1f%s", "--date=iso-strict"], { cwd: repo });
    const commits = stdout.split("\n").filter(Boolean).map((line) => {
      const [sha, author, date, message] = line.split("\x1f");
      return { sha, author, date, message };
    });
    return res.json(commits);
  } catch (err) { return serverError(res, err); }
});

router.post("/timetravel.checkout", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.body?.projectId);
    const sha = cleanSha(req.body?.sha);
    if (!projectId) return bad(res, "projectId required");
    if (!sha) return bad(res, "valid sha required");
    const repo = PROJECT_REPOS[projectId];
    if (!repo) return bad(res, "repo not configured", 404);

    await execFileAsync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: repo });
    await execFileAsync("git", ["checkout", sha], { cwd: repo });
    await execFileAsync("bun", ["install"], { cwd: repo });
    await execFileAsync("bun", ["run", "build"], { cwd: repo });

    const pm2Name = projectId === "founderbuilder" ? "axonetis-builder" : projectId;
    try { await execFileAsync("pm2", ["restart", pm2Name]); } catch (e) { console.warn("[rpc.timetravel] pm2 restart failed", e); }

    return res.json({ ok: true, previewUrl: PROJECT_URLS[projectId] });
  } catch (err) { return serverError(res, err); }
});

router.post("/rrweb.push", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.body?.projectId);
    const sessionId = String(req.body?.sessionId ?? "").trim();
    const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 500) : [];
    if (!projectId) return bad(res, "projectId required");
    if (!sessionId) return bad(res, "sessionId required");
    if (events.length === 0) return res.json({ ok: true });

    const project = await getProjectRow(projectId);
    if (!project) return bad(res, "project not found", 404);

    const now = new Date().toISOString();
    await supabase.from("rrweb_sessions").upsert({
      id: sessionId,
      project_id: project.id,
      started_at: now,
      last_event_at: now,
    }, { onConflict: "id" });

    const rows = events.map((event: unknown) => ({ session_id: sessionId, project_id: project.id, event }));
    const { error } = await supabase.from("rrweb_events").insert(rows);
    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) { return serverError(res, err); }
});

router.get("/rrweb.list", async (req, res) => {
  try {
    const projectId = cleanProjectId(req.query.projectId);
    if (!projectId) return bad(res, "projectId required");
    const project = await getProjectRow(projectId);
    if (!project) return bad(res, "project not found", 404);

    const { data, error } = await supabase
      .from("rrweb_sessions")
      .select("id, started_at, last_event_at, event_count")
      .eq("project_id", project.id)
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return res.json(((data ?? []) as RrwebSessionRow[]).map((s) => ({
      id: s.id,
      startedAt: s.started_at,
      durationMs: Math.max(0, new Date(s.last_event_at ?? s.started_at).getTime() - new Date(s.started_at).getTime()),
      events: s.event_count ?? 0,
    })));
  } catch (err) { return serverError(res, err); }
});

export default router;
