/**
 * Phase 10.1 + 10.2 — Replay bridge routes (hostflow-server, port 8090).
 * Mount:  app.use(replayRoutes)   in src/routes/index.ts
 *
 * Endpoints
 *   GET  /rpc/rrweb.list?projectId          → SessionMeta[]         (10.1)
 *   POST /rpc/rrweb.push                    → { ok }                (10.1)
 *   GET  /rpc/rrweb.events?projectId&sessionId → { events }         (10.1)
 *   POST /rpc/replay.analyze                → ReplayAnalysis        (10.2)
 *   POST /rpc/replay.applyfix               → { ok, diff_id }       (10.2)
 *
 * Tables: replay_sessions · replay_events · replay_analyses (Supabase 3)
 * SQL: sql/founder/phase-10-advantage/20260815000000_phase_101_103_replay_voice.sql
 */
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
router.use(express.json({ limit: "25mb" }));

const sb = () =>
  createClient(process.env.SUPABASE3_URL, process.env.SUPABASE3_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const bad = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });

// ── 10.1 push a batch of rrweb events ───────────────────────────────────────
router.post("/rpc/rrweb.push", async (req, res) => {
  const { projectId, sessionId, events } = req.body ?? {};
  if (!projectId || !sessionId) return bad(res, "projectId and sessionId required");
  if (!Array.isArray(events) || events.length === 0) return bad(res, "events required");

  const db = sb();
  const first = events[0]?.timestamp ?? Date.now();
  const last = events[events.length - 1]?.timestamp ?? first;

  const { data: existing } = await db
    .from("replay_sessions")
    .select("id, event_count, started_at")
    .eq("project_id", projectId)
    .eq("session_id", sessionId)
    .maybeSingle();

  let seq = 0;
  if (existing) {
    const startedMs = new Date(existing.started_at).getTime();
    const { count } = await db
      .from("replay_events")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("session_id", sessionId);
    seq = count ?? 0;
    await db
      .from("replay_sessions")
      .update({
        event_count: (existing.event_count ?? 0) + events.length,
        ended_at: new Date(last).toISOString(),
        duration_ms: Math.max(0, last - startedMs),
      })
      .eq("id", existing.id);
  } else {
    await db.from("replay_sessions").insert({
      project_id: projectId,
      session_id: sessionId,
      started_at: new Date(first).toISOString(),
      ended_at: new Date(last).toISOString(),
      duration_ms: Math.max(0, last - first),
      event_count: events.length,
      user_agent: req.headers["user-agent"] ?? null,
    });
  }

  const { error } = await db
    .from("replay_events")
    .insert({ project_id: projectId, session_id: sessionId, seq, events });
  if (error) return bad(res, error.message, 500);
  return res.json({ ok: true, count: events.length });
});

// ── 10.1 session list ───────────────────────────────────────────────────────
router.get("/rpc/rrweb.list", async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return bad(res, "projectId required");
  const { data, error } = await sb()
    .from("replay_sessions")
    .select("session_id, started_at, duration_ms, event_count")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) return bad(res, error.message, 500);
  return res.json(
    (data ?? []).map((r) => ({
      id: r.session_id,
      startedAt: r.started_at,
      durationMs: r.duration_ms ?? 0,
      events: r.event_count ?? 0,
    })),
  );
});

// ── 10.1 full event stream for one session ──────────────────────────────────
router.get("/rpc/rrweb.events", async (req, res) => {
  const { projectId, sessionId } = req.query ?? {};
  if (!projectId || !sessionId) return bad(res, "projectId and sessionId required");
  const { data, error } = await sb()
    .from("replay_events")
    .select("events, seq")
    .eq("project_id", projectId)
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  if (error) return bad(res, error.message, 500);
  const events = (data ?? []).flatMap((row) => row.events ?? []);
  return res.json({ ok: true, events });
});

// ── 10.2 Sherlock analysis ──────────────────────────────────────────────────
router.post("/rpc/replay.analyze", async (req, res) => {
  const { projectId, sessionId } = req.body ?? {};
  if (!projectId || !sessionId) return bad(res, "projectId and sessionId required");

  const db = sb();
  const { data: rows } = await db
    .from("replay_events")
    .select("events")
    .eq("project_id", projectId)
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  const events = (rows ?? []).flatMap((r) => r.events ?? []);
  if (events.length === 0) return bad(res, "no events for session", 404);

  // Extract console/network signal only — never ship whole DOM snapshots to the model.
  const signal = events
    .filter((e) => e.type === 6 && e.data)
    .map((e) => ({ at: e.timestamp, plugin: e.data.plugin, payload: e.data.payload }))
    .slice(-200);

  const brain = (process.env.HOSTFLOW_BRAIN_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  let parsed = null;
  try {
    const r = await fetch(`${brain}/api/founder/sherlock/audit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        message: `Analyze this rrweb session replay signal and return JSON {rootCause, summary, fix:{path,language,snippet}, confidence}. Signal: ${JSON.stringify(signal).slice(0, 20000)}`,
      }),
    });
    if (r.ok) {
      const body = await r.json();
      const text = body.text ?? body.output ?? body.content ?? "";
      const m = typeof text === "string" ? text.match(/\{[\s\S]*\}/) : null;
      if (m) parsed = JSON.parse(m[0]);
    }
  } catch {
    /* brain offline → fall back to deterministic heuristics below */
  }

  if (!parsed) {
    const errs = signal.filter(
      (s) => s.payload?.level === "error" || (s.payload?.status ?? 0) >= 400,
    );
    parsed = {
      rootCause: errs.length
        ? `${errs.length} error event(s) captured; first: ${JSON.stringify(errs[0].payload).slice(0, 300)}`
        : "No error signal captured in this session.",
      summary: `${events.length} events, ${signal.length} console/network records analyzed.`,
      fix: null,
      confidence: errs.length ? 55 : 20,
    };
  }

  const { data: saved, error } = await db
    .from("replay_analyses")
    .insert({
      project_id: projectId,
      session_id: sessionId,
      root_cause: String(parsed.rootCause ?? ""),
      summary: String(parsed.summary ?? ""),
      fix_path: parsed.fix?.path ?? null,
      fix_language: parsed.fix?.language ?? null,
      fix_snippet: parsed.fix?.snippet ?? null,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence ?? 0))),
    })
    .select()
    .single();
  if (error) return bad(res, error.message, 500);

  return res.json({
    id: saved.id,
    sessionId,
    rootCause: saved.root_cause,
    summary: saved.summary,
    suggestedFix: saved.fix_path
      ? { path: saved.fix_path, language: saved.fix_language ?? "typescript", snippet: saved.fix_snippet ?? "" }
      : null,
    confidence: saved.confidence,
    createdAt: saved.created_at,
  });
});

// ── 10.2 apply fix → creates an agent_diffs row for founder approval ────────
router.post("/rpc/replay.applyfix", async (req, res) => {
  const { projectId, sessionId, analysisId } = req.body ?? {};
  if (!projectId || !analysisId) return bad(res, "projectId and analysisId required");

  const db = sb();
  const { data: a, error: aErr } = await db
    .from("replay_analyses")
    .select("*")
    .eq("id", analysisId)
    .maybeSingle();
  if (aErr) return bad(res, aErr.message, 500);
  if (!a || !a.fix_path || !a.fix_snippet) return bad(res, "analysis has no suggested fix", 409);

  const { data: diff, error } = await db
    .from("agent_diffs")
    .insert({
      project_id: projectId,
      file_path: a.fix_path,
      new_content: a.fix_snippet,
      status: "pending",
      agent: "sherlock",
      summary: `Replay fix · session ${sessionId ?? ""} · confidence ${a.confidence}%`,
    })
    .select("id")
    .single();
  if (error) return bad(res, error.message, 500);

  await db.from("replay_analyses").update({ diff_id: diff.id }).eq("id", analysisId);
  return res.json({ ok: true, diff_id: diff.id });
});

export default router;
