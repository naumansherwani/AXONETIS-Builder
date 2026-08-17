/**
 * Phase 10.6 — AI Test Generator bridge routes (hostflow-server, port 8090).
 * Mount:  app.use(testsRoutes)   in src/index.ts (the Express entrypoint)
 *
 *   GET  /rpc/tests.list?projectId               → { files, coverage, runs }
 *   POST /rpc/tests.generate { projectId, path } → { ok, files }
 *   POST /rpc/tests.run      { projectId, file } → { ok, files, coverage }
 *
 * Tables: test_files · test_runs (Supabase 3)
 * SQL: sql/founder/phase-10-advantage/20260816000000_phase_104_1015.sql
 * Runner: `bun test` inside the project checkout (BUILDER_REPO_PATH).
 */
import express from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const exec = promisify(execFile);
const router = express.Router();
router.use(express.json({ limit: "4mb" }));

const sb = () =>
  createClient(process.env.SUPABASE3_URL, process.env.SUPABASE3_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const bad = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });
const REPO = process.env.BUILDER_REPO_PATH || "/var/www/axonetis";
const GEN_MODEL = process.env.TEST_GEN_MODEL || "qwen/qwen-2.5-coder-32b-instruct";

function fileRow(r) {
  return {
    id: r.id,
    path: r.path,
    origin: r.origin,
    status: r.status,
    total: r.total ?? 0,
    passed: r.passed ?? 0,
    failed: r.failed ?? 0,
    duration_ms: r.duration_ms ?? null,
    updated_at: r.updated_at,
  };
}

async function suiteState(db, projectId) {
  const [{ data: files }, { data: runs }] = await Promise.all([
    db
      .from("test_files")
      .select("*")
      .eq("project_id", projectId)
      .order("path", { ascending: true }),
    db
      .from("test_runs")
      .select("created_at, passed, failed, actor, coverage")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(40),
  ]);
  const list = (files ?? []).map(fileRow);
  const latestCoverage = (runs ?? []).length > 0 ? (runs[runs.length - 1].coverage ?? 0) : 0;
  return {
    files: list,
    coverage: Number(latestCoverage) || 0,
    runs: (runs ?? []).map((r) => ({
      at: r.created_at,
      passed: r.passed ?? 0,
      failed: r.failed ?? 0,
      actor: r.actor === "founder" ? "founder" : "sherlock",
    })),
  };
}

router.get("/rpc/tests.list", async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return bad(res, "projectId required");
  res.json(await suiteState(sb(), projectId));
});

// ── generate a test file for a source path (Sherlock writes it) ─────────────
router.post("/rpc/tests.generate", async (req, res) => {
  const { projectId, path } = req.body ?? {};
  if (!projectId || !path) return bad(res, "projectId and path required");
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_2;
  if (!key) return bad(res, "OPENROUTER_API_KEY missing on server", 500);

  const db = sb();
  const { data: src } = await db
    .from("project_files")
    .select("content")
    .eq("project_id", projectId)
    .eq("path", path)
    .maybeSingle();
  if (!src?.content) return bad(res, `source not found: ${path}`, 404);

  let code = "";
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GEN_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Write a single vitest/bun-test compatible test file. Output ONLY code, no prose, no markdown fences.",
          },
          { role: "user", content: `File: ${path}\n\n${src.content}` },
        ],
      }),
    });
    const j: any = await r.json();
    if (!r.ok) return bad(res, j?.error?.message || `model ${r.status}`, 502);
    code = String(j?.choices?.[0]?.message?.content ?? "").replace(/^```[a-z]*|```$/gm, "").trim();
  } catch (e) {
    return bad(res, `generate failed: ${e?.message ?? e}`, 502);
  }
  if (!code) return bad(res, "model returned empty test", 502);

  const testPath = path.replace(/\.(tsx?|jsx?)$/, ".test.$1");
  await db
    .from("project_files")
    .upsert(
      { project_id: projectId, path: testPath, content: code },
      { onConflict: "project_id,path" },
    );
  await db.from("test_files").upsert(
    {
      project_id: projectId,
      path: testPath,
      origin: "generated",
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,path" },
  );

  const state = await suiteState(db, projectId);
  res.json({ ok: true, files: state.files });
});

// ── run tests (single file or all) ──────────────────────────────────────────
router.post("/rpc/tests.run", async (req, res) => {
  const { projectId, file } = req.body ?? {};
  if (!projectId) return bad(res, "projectId required");
  const db = sb();

  const args = file ? ["test", file] : ["test"];
  const started = Date.now();
  let stdout = "";
  let stderr = "";
  let failedRun = false;
  try {
    const out = await exec("bun", args, { cwd: REPO, timeout: 300_000, maxBuffer: 8 * 1024 * 1024 });
    stdout = out.stdout ?? "";
    stderr = out.stderr ?? "";
  } catch (e) {
    failedRun = true;
    stdout = e?.stdout ?? "";
    stderr = e?.stderr ?? String(e?.message ?? e);
  }
  const blob = `${stdout}\n${stderr}`;
  const pass = Number(/(\d+)\s+pass/i.exec(blob)?.[1] ?? 0);
  const fail = Number(/(\d+)\s+fail/i.exec(blob)?.[1] ?? (failedRun ? 1 : 0));
  const coverage = Number(/all files\s*\|\s*([\d.]+)/i.exec(blob)?.[1] ?? 0);
  const duration = Date.now() - started;

  if (file) {
    await db
      .from("test_files")
      .update({
        status: fail > 0 ? "fail" : "pass",
        total: pass + fail,
        passed: pass,
        failed: fail,
        duration_ms: duration,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("path", file);
  } else {
    await db
      .from("test_files")
      .update({ status: fail > 0 ? "fail" : "pass", updated_at: new Date().toISOString() })
      .eq("project_id", projectId);
  }

  await db.from("test_runs").insert({
    project_id: projectId,
    passed: pass,
    failed: fail,
    coverage,
    actor: "sherlock",
    duration_ms: duration,
    log: blob.slice(-8000),
  });

  const state = await suiteState(db, projectId);
  res.json({ ok: fail === 0, files: state.files, coverage: state.coverage || coverage });
});

export default router;
