/**
 * Phase 10.12 + 10.13 + 10.14 + 10.15 — Ops bridge routes (hostflow-server, 8090).
 * Mount:  app.use(opsRoutes)   in src/routes/index.ts
 *
 *  10.12  POST /rpc/advisor.route      { projectId, advisor, prompt } → AdvisorAnswer
 *  10.13  GET  /rpc/sandbox.status?projectId                         → SandboxStatus
 *         POST /rpc/sandbox.switch     { projectId, kind }           → SandboxStatus
 *         POST /rpc/sandbox.reset      { projectId }                 → { ok, reset_at }
 *  10.14  GET  /rpc/explain.get?projectId&messageId                  → Explanation
 *  10.15  GET  /rpc/telemetry.snapshot?projectId                     → TelemetrySnapshot
 *         GET  /rpc/telemetry.stream?projectId                       → SSE system|ai|cost|revenue|users
 *
 * Tables: project_envs · agent_thread_messages · tool_call_registry · mem_entries
 *         · agent_plans · outreach_leads (all existing — NO duplicates)
 * SQL: sql/founder/phase-10-advantage/20260816000000_phase_104_1015.sql
 */
import express from "express";
import os from "node:os";
import { statfs } from "node:fs";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const statfsAsync = promisify(statfs);
const router = express.Router();
router.use(express.json({ limit: "2mb" }));

const sb = () =>
  createClient(process.env.SUPABASE3_URL, process.env.SUPABASE3_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const bad = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });

// ════════════════════════════ 10.12 advisors ════════════════════════════════
const ADVISOR_MODELS = {
  aria: "google/gemini-2.0-flash-001",
  orion: "deepseek/deepseek-chat",
  rex: "meta-llama/llama-3.3-70b-instruct",
  lyra: "google/gemini-2.0-flash-001",
  sage: "qwen/qwen-2.5-72b-instruct",
  atlas: "meta-llama/llama-3.3-70b-instruct",
  vega: "deepseek/deepseek-chat",
  kai: "qwen/qwen-2.5-coder-32b-instruct",
};
const ADVISOR_DOMAIN = {
  aria: "Healthcare",
  orion: "Finance",
  rex: "Legal",
  lyra: "Marketing",
  sage: "Education",
  atlas: "Logistics",
  vega: "Retail",
  kai: "Engineering",
};

router.post("/rpc/advisor.route", async (req, res) => {
  const { projectId, advisor, prompt } = req.body ?? {};
  if (!projectId || !advisor || !prompt) return bad(res, "projectId, advisor and prompt required");
  const slug = String(advisor).toLowerCase();
  const model = ADVISOR_MODELS[slug];
  if (!model) return bad(res, `unknown advisor: ${slug}`, 404);
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_2;
  if (!key) return bad(res, "OPENROUTER_API_KEY missing on server", 500);

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are ${slug}, the ${ADVISOR_DOMAIN[slug]} industry advisor for the founder. Reply in the founder's own style: Roman Urdu/Hindi mixed with technical English, short, no greetings, no corporate filler.`,
          },
          { role: "user", content: String(prompt) },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) return bad(res, j?.error?.message || `advisor ${r.status}`, 502);
    const answer = String(j?.choices?.[0]?.message?.content ?? "").trim();
    await sb().from("advisor_answers").insert({
      project_id: projectId,
      advisor: slug,
      domain: ADVISOR_DOMAIN[slug],
      model,
      prompt,
      answer,
    });
    res.json({ advisor: slug, domain: ADVISOR_DOMAIN[slug], model, answer });
  } catch (e) {
    bad(res, `advisor failed: ${e?.message ?? e}`, 502);
  }
});

// ════════════════════════════ 10.13 sandbox ═════════════════════════════════
async function envStatus(db, projectId) {
  const { data } = await db
    .from("project_envs")
    .select("kind, created_at, expires_at, row_count, active")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const active = (data ?? []).find((r) => r.active) ?? null;
  const kind = active?.kind === "sandbox" ? "sandbox" : "production";
  return {
    kind,
    isolated: kind === "sandbox",
    created_at: active?.created_at ?? null,
    expires_at: active?.expires_at ?? null,
    rows: active?.row_count ?? null,
  };
}

router.get("/rpc/sandbox.status", async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return bad(res, "projectId required");
  res.json(await envStatus(sb(), projectId));
});

router.post("/rpc/sandbox.switch", async (req, res) => {
  const { projectId, kind } = req.body ?? {};
  if (!projectId || !["production", "sandbox"].includes(kind))
    return bad(res, "projectId and kind (production|sandbox) required");
  const db = sb();
  await db.from("project_envs").update({ active: false }).eq("project_id", projectId);
  const { error } = await db.from("project_envs").upsert(
    {
      project_id: projectId,
      kind,
      active: true,
      expires_at:
        kind === "sandbox" ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
    },
    { onConflict: "project_id,kind" },
  );
  if (error) return bad(res, error.message, 500);
  res.json(await envStatus(db, projectId));
});

router.post("/rpc/sandbox.reset", async (req, res) => {
  const { projectId } = req.body ?? {};
  if (!projectId) return bad(res, "projectId required");
  const db = sb();
  const reset_at = new Date().toISOString();
  // Sandbox-scoped rows only — production untouched.
  const wipes = ["sandbox_files", "sandbox_rows"];
  for (const t of wipes) {
    await db.from(t).delete().eq("project_id", projectId);
  }
  const { error } = await db
    .from("project_envs")
    .update({ row_count: 0, reset_at })
    .eq("project_id", projectId)
    .eq("kind", "sandbox");
  if (error) return bad(res, error.message, 500);
  res.json({ ok: true, reset_at });
});

// ════════════════════════════ 10.14 explainability ══════════════════════════
router.get("/rpc/explain.get", async (req, res) => {
  const { projectId, messageId } = req.query;
  if (!projectId || !messageId) return bad(res, "projectId and messageId required");
  const db = sb();

  const { data: msg } = await db
    .from("agent_thread_messages")
    .select("id, model, tokens_in, tokens_out, cost_usd, content, created_at, agent_slug")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return bad(res, "message not found", 404);

  const [{ data: tools }, { data: mem }, { data: plans }] = await Promise.all([
    db
      .from("tool_call_registry")
      .select("id, tool_name, status, created_at, duration_ms")
      .eq("message_id", messageId)
      .order("created_at", { ascending: true }),
    db
      .from("mem_entries")
      .select("id, title, body")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(5),
    db
      .from("agent_plans")
      .select("id, title, status, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const chain = [];
  let idx = 0;
  if ((plans ?? []).length > 0)
    chain.push({
      id: `plan_${plans[0].id}`,
      index: idx++,
      label: `Plan: ${plans[0].title}`,
      kind: "plan",
      detail: `status ${plans[0].status}`,
    });
  chain.push({
    id: `route_${msg.id}`,
    index: idx++,
    label: `Routed to ${msg.model ?? "default model"}`,
    kind: "route",
    detail: `${msg.tokens_in ?? 0} in / ${msg.tokens_out ?? 0} out`,
  });
  for (const t of tools ?? [])
    chain.push({
      id: `tool_${t.id}`,
      index: idx++,
      label: `Tool ${t.tool_name}`,
      kind: "tool",
      detail: t.status,
    });
  chain.push({
    id: `answer_${msg.id}`,
    index: idx++,
    label: `${msg.agent_slug ?? "jimmy"} answered`,
    kind: "answer",
    detail: null,
  });

  res.json({
    messageId: msg.id,
    why: `${msg.agent_slug ?? "jimmy"} ne ${msg.model ?? "default model"} use kiya, ${(tools ?? []).length} tool call kiye aur ${(mem ?? []).length} memory entries padhi.`,
    model: msg.model ?? null,
    modelReason: "cost-aware router pick (see Costs panel)",
    tokensIn: msg.tokens_in ?? 0,
    tokensOut: msg.tokens_out ?? 0,
    costUsd: typeof msg.cost_usd === "number" ? msg.cost_usd : null,
    memory: (mem ?? []).map((m) => ({
      id: m.id,
      title: m.title ?? "memory",
      snippet: String(m.body ?? "").slice(0, 180),
      score: null,
    })),
    tools: (tools ?? []).map((t) => ({
      id: t.id,
      name: t.tool_name,
      status: t.status === "error" ? "error" : t.status === "running" ? "running" : "ok",
      at: t.created_at,
      duration_ms: t.duration_ms ?? null,
    })),
    chain,
  });
});

// ════════════════════════════ 10.15 telemetry ═══════════════════════════════
let lastCpu = os.cpus();

function cpuPercent() {
  const now = os.cpus();
  let idle = 0;
  let total = 0;
  now.forEach((c, i) => {
    const prev = lastCpu[i]?.times ?? c.times;
    const dIdle = c.times.idle - prev.idle;
    const dTotal =
      Object.keys(c.times).reduce((n, k) => n + (c.times[k] - prev[k]), 0) || 1;
    idle += dIdle;
    total += dTotal;
  });
  lastCpu = now;
  return Math.max(0, Math.min(100, Math.round((1 - idle / (total || 1)) * 100)));
}

async function systemHealth() {
  let disk = 0;
  try {
    const s = await statfsAsync("/");
    disk = Math.round(((s.blocks - s.bfree) / (s.blocks || 1)) * 100);
  } catch {
    disk = 0;
  }
  return {
    cpu: cpuPercent(),
    ram: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    disk,
    loadAvg: Number(os.loadavg()[0].toFixed(2)),
    uptimeSeconds: Math.round(os.uptime()),
  };
}

async function aiRpm(db, projectId) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from("agent_thread_messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gte("created_at", since);
  return { at: Date.now(), rpm: count ?? 0 };
}

async function costSeries(db, projectId) {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await db
    .from("agent_thread_messages")
    .select("created_at, cost_usd")
    .eq("project_id", projectId)
    .gte("created_at", since);
  const byDay = new Map();
  for (const r of data ?? []) {
    const day = String(r.created_at).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (Number(r.cost_usd) || 0));
  }
  return [...byDay.entries()].sort().map(([day, usd]) => ({ day, usd: Number(usd.toFixed(4)) }));
}

async function revenueSeries(db) {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await db
    .from("outreach_leads")
    .select("closed_at, mrr_usd")
    .eq("stage", "closed")
    .gte("closed_at", since);
  const byDay = new Map();
  for (const r of data ?? []) {
    if (!r.closed_at) continue;
    const day = String(r.closed_at).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (Number(r.mrr_usd) || 0));
  }
  return [...byDay.entries()].sort().map(([day, usd]) => ({ day, usd: Number(usd.toFixed(2)) }));
}

async function activeUsers(db, projectId) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data } = await db
    .from("agent_thread_messages")
    .select("thread_id")
    .eq("project_id", projectId)
    .gte("created_at", since);
  return new Set((data ?? []).map((r) => r.thread_id)).size;
}

router.get("/rpc/telemetry.snapshot", async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return bad(res, "projectId required");
  const db = sb();
  try {
    const [system, ai, cost, revenue, users] = await Promise.all([
      systemHealth(),
      aiRpm(db, projectId),
      costSeries(db, projectId),
      revenueSeries(db),
      activeUsers(db, projectId),
    ]);
    res.json({ system, ai: [ai], cost, revenue, activeUsers: users });
  } catch (e) {
    bad(res, `telemetry failed: ${e?.message ?? e}`, 500);
  }
});

router.get("/rpc/telemetry.stream", async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return bad(res, "projectId required");
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.write(": connected\n\n");
  const db = sb();
  const send = (event, payload) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);

  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      send("system", await systemHealth());
      send("ai", await aiRpm(db, projectId));
      send("users", { count: await activeUsers(db, projectId) });
    } catch {
      /* keep the stream alive */
    }
  };
  const slowTick = async () => {
    if (stopped) return;
    try {
      const [cost, revenue] = await Promise.all([costSeries(db, projectId), revenueSeries(db)]);
      if (cost.length > 0) send("cost", cost[cost.length - 1]);
      if (revenue.length > 0) send("revenue", revenue[revenue.length - 1]);
    } catch {
      /* noop */
    }
  };

  await tick();
  await slowTick();
  const fast = setInterval(tick, 5_000);
  const slow = setInterval(slowTick, 30_000);
  req.on("close", () => {
    stopped = true;
    clearInterval(fast);
    clearInterval(slow);
  });
});

export default router;
