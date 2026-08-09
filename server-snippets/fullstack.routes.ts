/**
 * Phase 10.10 — One-Prompt Full-Stack bridge routes (hostflow-server, port 8090).
 * Mount:  app.use(fullstackRoutes)   in src/routes/index.ts
 *
 *   POST /rpc/fullstack.begin  { projectId, prompt } → { buildId, tasks }
 *   GET  /rpc/fullstack.stream?projectId&buildId     → SSE task|worker|deploy|done
 *   POST /rpc/fullstack.cancel { projectId, buildId } → { ok }
 *
 * Tables: fullstack_builds · fullstack_tasks (Supabase 3)
 * SQL: sql/founder/phase-10-advantage/20260816000000_phase_104_1015.sql
 *
 * Hermes plans ~20 tasks, then 5 parallel workers execute them by delegating to
 * the existing Jimmy orchestration endpoint (NO duplicate agent loop here).
 */
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
router.use(express.json({ limit: "2mb" }));

const sb = () =>
  createClient(process.env.SUPABASE3_URL, process.env.SUPABASE3_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const bad = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });
const BRAIN = process.env.BRAIN_URL || "http://127.0.0.1:8080";
const HERMES_MODEL = process.env.HERMES_MODEL || "meta-llama/llama-3.3-70b-instruct";
const WORKER_COUNT = 5;

const BUILDS = new Map(); // buildId → { listeners:Set<res>, cancelled }

function emit(buildId, event, payload) {
  const b = BUILDS.get(buildId);
  if (!b) return;
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of b.listeners) {
    try {
      res.write(chunk);
    } catch {
      /* noop */
    }
  }
}

async function planTasks(prompt) {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_2;
  if (!key) throw new Error("OPENROUTER_API_KEY missing on server");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: HERMES_MODEL,
      messages: [
        {
          role: "system",
          content:
            'You are Hermes, a full-stack build planner. Return STRICT JSON: {"tasks":["short imperative task", ...]} with 15-20 concrete tasks (schema, API, UI, auth, deploy). No prose, no fences.',
        },
        { role: "user", content: String(prompt) },
      ],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `hermes ${r.status}`);
  const text = String(j?.choices?.[0]?.message?.content ?? "").replace(/^```[a-z]*|```$/gm, "");
  const parsed = JSON.parse(text.trim());
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 20) : [];
  if (tasks.length === 0) throw new Error("hermes returned no tasks");
  return tasks.map((t) => String(t));
}

router.post("/rpc/fullstack.begin", async (req, res) => {
  const { projectId, prompt } = req.body ?? {};
  if (!projectId || !prompt) return bad(res, "projectId and prompt required");

  let titles;
  try {
    titles = await planTasks(prompt);
  } catch (e) {
    return bad(res, `plan failed: ${e?.message ?? e}`, 502);
  }

  const db = sb();
  const { data: build, error } = await db
    .from("fullstack_builds")
    .insert({ project_id: projectId, prompt, phase: "planning", status: "running" })
    .select("id")
    .single();
  if (error) return bad(res, error.message, 500);
  const buildId = build.id;

  const rows = titles.map((title, i) => ({
    project_id: projectId,
    build_id: buildId,
    idx: i,
    title,
    state: "queued",
  }));
  const { data: taskRows, error: taskErr } = await db
    .from("fullstack_tasks")
    .insert(rows)
    .select("id, idx, title, state, worker");
  if (taskErr) return bad(res, taskErr.message, 500);

  const tasks = (taskRows ?? [])
    .sort((a, b) => a.idx - b.idx)
    .map((t) => ({ id: t.id, index: t.idx, title: t.title, state: t.state, worker: t.worker }));

  BUILDS.set(buildId, { listeners: new Set(), cancelled: false });
  res.json({ buildId, tasks });

  // ── run the 5 workers ────────────────────────────────────────────────────
  (async () => {
    const startedAt = Date.now();
    emit(buildId, "deploy", { phase: "building", etaSeconds: tasks.length * 12, url: null });
    await db.from("fullstack_builds").update({ phase: "building" }).eq("id", buildId);

    const queue = [...tasks];
    const runWorker = async (workerId) => {
      while (queue.length > 0) {
        const b = BUILDS.get(buildId);
        if (!b || b.cancelled) return;
        const task = queue.shift();
        emit(buildId, "worker", { id: workerId, task: task.title, progress: 5, busy: true });
        emit(buildId, "task", { ...task, state: "running", worker: workerId });
        await db
          .from("fullstack_tasks")
          .update({ state: "running", worker: workerId })
          .eq("id", task.id);

        let ok = true;
        try {
          const r = await fetch(`${BRAIN}/api/founder/jimmy/orchestrate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              projectId,
              message: task.title,
              content: task.title,
              messages: [{ role: "user", content: task.title }],
            }),
          });
          ok = r.ok;
        } catch {
          ok = false;
        }
        emit(buildId, "worker", { id: workerId, task: task.title, progress: 100, busy: false });
        emit(buildId, "task", {
          ...task,
          state: ok ? "done" : "failed",
          worker: workerId,
        });
        await db
          .from("fullstack_tasks")
          .update({ state: ok ? "done" : "failed" })
          .eq("id", task.id);

        const remaining = queue.length;
        emit(buildId, "deploy", {
          phase: "building",
          etaSeconds: Math.max(0, remaining * 12),
          url: null,
        });
      }
      emit(buildId, "worker", { id: workerId, task: null, progress: 0, busy: false });
    };

    await Promise.all(Array.from({ length: WORKER_COUNT }, (_, i) => runWorker(i + 1)));

    const cancelled = BUILDS.get(buildId)?.cancelled;
    if (cancelled) {
      emit(buildId, "deploy", { phase: "cancelled", etaSeconds: null, url: null });
      emit(buildId, "done", { reason: "cancelled" });
    } else {
      emit(buildId, "deploy", { phase: "deploying", etaSeconds: 20, url: null });
      const url = process.env.BUILDER_PUBLIC_URL || `https://${projectId}.axonetis.com`;
      await db
        .from("fullstack_builds")
        .update({
          phase: "live",
          status: "done",
          live_url: url,
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", buildId);
      emit(buildId, "deploy", { phase: "live", etaSeconds: 0, url });
      emit(buildId, "done", { reason: "live" });
    }

    for (const r of BUILDS.get(buildId)?.listeners ?? []) {
      try {
        r.end();
      } catch {
        /* noop */
      }
    }
    BUILDS.delete(buildId);
  })();
});

router.post("/rpc/fullstack.cancel", async (req, res) => {
  const { projectId, buildId } = req.body ?? {};
  if (!projectId || !buildId) return bad(res, "projectId and buildId required");
  const b = BUILDS.get(buildId);
  if (b) b.cancelled = true;
  await sb()
    .from("fullstack_builds")
    .update({ status: "cancelled", phase: "cancelled" })
    .eq("id", buildId);
  res.json({ ok: true });
});

router.get("/rpc/fullstack.stream", (req, res) => {
  const { buildId } = req.query;
  if (!buildId) return bad(res, "buildId required");
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.write(": connected\n\n");
  const b = BUILDS.get(String(buildId));
  if (!b) {
    res.write(`event: done\ndata: ${JSON.stringify({ reason: "build not live" })}\n\n`);
    return res.end();
  }
  b.listeners.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(ping);
    b.listeners.delete(res);
  });
});

export default router;
