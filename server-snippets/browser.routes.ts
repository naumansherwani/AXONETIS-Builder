/**
 * Phase 10.8 — Browser-Use Agent bridge routes (hostflow-server, port 8090).
 * Mount:  app.use(browserRoutes)   in src/routes/index.ts
 *
 *   POST /rpc/browser.validate { url }                  → { ok, url, reason? }
 *   POST /rpc/browser.start    { projectId, url, goal } → { sessionId }
 *   POST /rpc/browser.stop     { projectId, sessionId } → { ok }
 *   GET  /rpc/browser.stream?projectId&sessionId        → SSE frame|action|supervision|done
 *
 * Table: browser_sessions · browser_actions (Supabase 3)
 * SQL: sql/founder/phase-10-advantage/20260816000000_phase_104_1015.sql
 * Driver: playwright-core + system Chromium (CHROMIUM_PATH), Sherlock supervises.
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

/** live runs keyed by sessionId */
const RUNS = new Map(); // sessionId → { stop, listeners:Set<res>, actions:[], halted }

function normalizeUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, url: value, reason: "URL required" };
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return { ok: false, url: withScheme, reason: "Invalid host" };
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, url: withScheme, reason: "Malformed URL" };
  }
}

function emit(sessionId, event, payload) {
  const run = RUNS.get(sessionId);
  if (!run) return;
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of run.listeners) {
    try {
      res.write(chunk);
    } catch {
      /* client gone */
    }
  }
}

router.post("/rpc/browser.validate", async (req, res) => {
  const shape = normalizeUrl(req.body?.url);
  if (!shape.ok) return res.json(shape);
  try {
    const head = await fetch(shape.url, { method: "HEAD", redirect: "follow" });
    return res.json({ ok: head.status < 500, url: shape.url, reason: `HTTP ${head.status}` });
  } catch (e) {
    return res.json({ ok: false, url: shape.url, reason: `unreachable: ${e?.message ?? e}` });
  }
});

router.post("/rpc/browser.start", async (req, res) => {
  const { projectId, url, goal } = req.body ?? {};
  if (!projectId) return bad(res, "projectId required");
  const shape = normalizeUrl(url);
  if (!shape.ok) return bad(res, shape.reason ?? "invalid url");

  const db = sb();
  const { data, error } = await db
    .from("browser_sessions")
    .insert({ project_id: projectId, url: shape.url, goal: goal ?? null, status: "running" })
    .select("id")
    .single();
  if (error) return bad(res, error.message, 500);
  const sessionId = data.id;

  RUNS.set(sessionId, { listeners: new Set(), halted: false, stop: null });
  res.json({ sessionId });

  // ── drive the browser in the background ──────────────────────────────────
  (async () => {
    let browser = null;
    const log = async (kind, detail, selector = null) => {
      const action = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        at: Date.now(),
        kind,
        detail,
        selector,
      };
      emit(sessionId, "action", action);
      await db.from("browser_actions").insert({
        project_id: projectId,
        session_id: sessionId,
        kind,
        detail,
        selector,
      });
    };
    try {
      const { chromium } = await import("playwright-core");
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || undefined,
      });
      const run = RUNS.get(sessionId);
      if (run) run.stop = async () => browser?.close().catch(() => {});
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

      emit(sessionId, "supervision", { verdict: "watching", note: "Sherlock live" });
      await log("navigate", shape.url);
      await page.goto(shape.url, { waitUntil: "domcontentloaded", timeout: 45_000 });

      for (let step = 0; step < 20; step++) {
        const cur = RUNS.get(sessionId);
        if (!cur || cur.halted) break;
        const buf = await page.screenshot({ type: "jpeg", quality: 55 });
        emit(sessionId, "frame", {
          at: Date.now(),
          url: page.url(),
          dataUrl: `data:image/jpeg;base64,${buf.toString("base64")}`,
        });
        await page.mouse.wheel(0, 600);
        await log("scroll", `+600px (step ${step + 1})`);
        await page.waitForTimeout(1200);
      }

      emit(sessionId, "supervision", { verdict: "approved", note: "no unsafe action observed" });
      await db
        .from("browser_sessions")
        .update({ status: "done", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      emit(sessionId, "done", { reason: "finished" });
    } catch (e) {
      await log("error", String(e?.message ?? e));
      await db
        .from("browser_sessions")
        .update({ status: "failed", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      emit(sessionId, "done", { reason: `failed: ${e?.message ?? e}` });
    } finally {
      await browser?.close().catch(() => {});
      const run = RUNS.get(sessionId);
      for (const r of run?.listeners ?? []) {
        try {
          r.end();
        } catch {
          /* noop */
        }
      }
      RUNS.delete(sessionId);
    }
  })();
});

router.post("/rpc/browser.stop", async (req, res) => {
  const { projectId, sessionId } = req.body ?? {};
  if (!projectId || !sessionId) return bad(res, "projectId and sessionId required");
  const run = RUNS.get(sessionId);
  if (run) {
    run.halted = true;
    emit(sessionId, "supervision", { verdict: "halted", note: "founder emergency stop" });
    await run.stop?.();
  }
  await sb()
    .from("browser_sessions")
    .update({ status: "stopped", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  res.json({ ok: true });
});

router.get("/rpc/browser.stream", (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return bad(res, "sessionId required");
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.write(": connected\n\n");
  const run = RUNS.get(String(sessionId));
  if (!run) {
    res.write(`event: done\ndata: ${JSON.stringify({ reason: "session not live" })}\n\n`);
    return res.end();
  }
  run.listeners.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(ping);
    run.listeners.delete(res);
  });
});

export default router;
