// ============================================================
// AXONETIS™ Builder — Phase 3.10.3-B  diff.apply (bridge side)
// Target Hetzner path:
//   <hostflow-server repo>/src/routes/diff.routes.ts
//
// Mount in server entry (NO DUPLICATE router):
//   import diffRouter from "./routes/diff.routes.js";
//   app.use("/rpc", diffRouter);       // → POST /rpc/diff.apply
//
// Called by builder route src/routes/api/agents.diff.decision.ts AFTER the
// founder approves. This is the ONLY place code is written to disk + committed.
// ============================================================

import { Router, type Request, type Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);
const router = Router();

const PROJECT_REPOS: Record<string, string> = {
  hostflowai: "/var/www/hostflowai",
  nexatect: "/var/www/hostflowai",
  rapidpay: "/var/www/anexvot-ai-pay",
  anexvotaipay: "/var/www/anexvot-ai-pay",
  founderbuilder: "/var/www/axonetis",
  axonetis: "/var/www/axonetis",
};

const supabase = createClient(
  process.env.SUPABASE3_URL ?? "",
  process.env.SUPABASE3_SERVICE_ROLE_KEY ?? "",
  { auth: { persistSession: false } },
);

type DiffRow = {
  id: string;
  project_slug: string | null;
  path: string;
  new_content: string | null;
  status: string;
};

function safeJoin(root: string, rel: string): string | null {
  const target = path.resolve(root, rel.replace(/^\/+/, ""));
  return target.startsWith(path.resolve(root) + path.sep) ? target : null;
}

router.post("/diff.apply", async (req: Request, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.diff_ids)
    ? req.body.diff_ids.filter((v: unknown) => typeof v === "string")
    : typeof req.body?.diff_id === "string"
      ? [req.body.diff_id]
      : [];
  if (ids.length === 0) return res.status(400).json({ ok: false, error: "diff_id required" });

  const { data, error } = await supabase
    .from("agent_diffs")
    .select("id, project_slug, path, new_content, status")
    .in("id", ids);
  if (error) return res.status(500).json({ ok: false, error: error.message });

  const rows = (data ?? []) as DiffRow[];
  const results: Array<{ id: string; path: string; ok: boolean; error?: string }> = [];
  const touchedRepos = new Set<string>();

  for (const row of rows) {
    const root = PROJECT_REPOS[row.project_slug ?? "founderbuilder"];
    if (!root) {
      results.push({ id: row.id, path: row.path, ok: false, error: "unknown project_slug" });
      continue;
    }
    const target = safeJoin(root, row.path);
    if (!target) {
      results.push({ id: row.id, path: row.path, ok: false, error: "path escapes repo" });
      continue;
    }
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, row.new_content ?? "", "utf8");
      touchedRepos.add(root);
      results.push({ id: row.id, path: row.path, ok: true });
      await supabase
        .from("agent_diffs")
        .update({ status: "applied", applied_at: new Date().toISOString() })
        .eq("id", row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: row.id, path: row.path, ok: false, error: message });
      await supabase.from("agent_diffs").update({ status: "error", error: message }).eq("id", row.id);
    }
  }

  const commits: Array<{ repo: string; ok: boolean; error?: string }> = [];
  for (const repo of touchedRepos) {
    try {
      await execFileAsync("git", ["add", "-A"], { cwd: repo });
      await execFileAsync(
        "git",
        ["commit", "-m", `AXONETIS: apply ${results.filter((r) => r.ok).length} approved diff(s)`],
        { cwd: repo },
      );
      commits.push({ repo, ok: true });
    } catch (err) {
      commits.push({ repo, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return res.json({ ok: results.every((r) => r.ok), results, commits });
});

export default router;
