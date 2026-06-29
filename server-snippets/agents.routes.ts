/**
 * AXONETIS Phase 3 — Agents API router
 * Target server: hostflowai-server (Hetzner, Node + Express + Supabase 3)
 *
 * Mount in main server:
 *   import { agentsRouter } from "./routes/agents.routes";
 *   app.use("/api/agents", agentsRouter);
 *
 * CONTRACT (LOCKED — matches src/lib/hostflow-api.ts in Builder repo):
 * - NO { success, data } envelope. Return raw JSON arrays/objects.
 * - HTTP status = success signal.
 * - Chat is ASYNC ack only — reply text streams via thread messages / SSE.
 * - Source of truth for model routing = agent_registry.routing_config (Supabase 3).
 *   NEVER hardcode models in TypeScript.
 */

import { Router, type Request, type Response } from "express";
import { supabase3 as supabase } from "../integrations/supabase3/client.js";
import { enqueueAgentReply } from "../workers/agents.worker.js";
import { randomUUID } from "crypto";

// ── Types (must mirror frontend src/lib/hostflow-api.ts) ──────────────
type AgentSlug =
  | "jimmy" | "sherlock"
  | "aria" | "orion" | "rex" | "lyra" | "sage" | "atlas" | "vega" | "kai"
  | "router";

const AGENT_SLUGS: ReadonlySet<string> = new Set([
  "jimmy","sherlock",
  "aria","orion","rex","lyra","sage","atlas","vega","kai",
  "router",
]);

const isAgentSlug = (s: string): s is AgentSlug => AGENT_SLUGS.has(s);

// ── Helpers ───────────────────────────────────────────────────────────
const badRequest = (res: Response, msg: string) => res.status(400).json({ error: msg });
const notFound  = (res: Response, msg: string) => res.status(404).json({ error: msg });
const serverError = (res: Response, err: unknown) => {
  console.error("[agents]", err);
  return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
};

// ── Router ────────────────────────────────────────────────────────────
export const agentsRouter = Router();

/* GET /api/agents → AgentInfo[] (raw array) */
agentsRouter.get("/", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("agent_registry")
      .select("slug, name, role, kind, model_primary, model_fallback, routing_config, status")
      .order("kind", { ascending: true });
    if (error) throw error;
    res.json(data ?? []);
  } catch (e) { serverError(res, e); }
});

/* POST /api/agents/:slug/chat
   body: { projectId, threadId?, prompt }
   resp: { threadId, messageId, status } — ASYNC ack, no reply text */
agentsRouter.post("/:slug/chat", async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!isAgentSlug(slug)) return badRequest(res, "Invalid agent slug");
    const { projectId, threadId, prompt } = req.body ?? {};
    if (!projectId || !prompt) return badRequest(res, "projectId and prompt required");

    let tid = threadId as string | undefined;
    if (!tid) {
      const { data: t, error: tErr } = await supabase
        .from("agent_threads")
        .insert({ project_id: projectId, agent_slug: slug, title: prompt.slice(0, 80) })
        .select("id").single();
      if (tErr) throw tErr;
      tid = t.id;
    }

    const { data: msg, error: mErr } = await supabase
      .from("agent_thread_messages")
      .insert({
        thread_id: tid, role: "user", agent_slug: slug,
        parts: [{ type: "text", text: prompt }],
        tokens_in: 0, tokens_out: 0,
      })
      .select("id").single();
    if (mErr) throw mErr;

    await supabase.from("agent_activity").insert({
      agent_slug: slug, project_id: projectId, thread_id: tid,
      kind: "chat", summary: prompt.slice(0, 200),
      tokens_in: 0, tokens_out: 0, cost_usd: 0, status: "thinking",
    });

    // Kick off async LLM job (worker reads routing_config from agent_registry,
    // then OpenRouter → Groq → Ollama, then inserts assistant message + activity row).
    // enqueueAgentReply({ threadId: tid!, messageId: msg.id, agentSlug: slug, projectId, prompt });

    res.json({ threadId: tid, messageId: msg.id, status: "queued" });
  } catch (e) { serverError(res, e); }
});

/* POST /api/agents/sherlock/scan → { scanId, status } */
agentsRouter.post("/sherlock/scan", async (req, res) => {
  try {
    const { projectId, target } = req.body ?? {};
    if (!projectId) return badRequest(res, "projectId required");
    const scanId = randomUUID();
    await supabase.from("agent_activity").insert({
      id: scanId, agent_slug: "sherlock", project_id: projectId,
      kind: "scan", summary: `Sherlock scan: ${target ?? "full project"}`,
      tokens_in: 0, tokens_out: 0, cost_usd: 0, status: "thinking",
    });
    // enqueueSherlockScan({ scanId, projectId, target });
    res.json({ scanId, status: "queued" });
  } catch (e) { serverError(res, e); }
});

/* GET /api/agents/threads?projectId=&agentSlug= → AgentThread[] (raw array) */
agentsRouter.get("/threads", async (req, res) => {
  try {
    let q = supabase
      .from("agent_threads")
      .select("id, project_id, agent_slug, title, message_count, last_message_at, updated_at")
      .order("updated_at", { ascending: false });
    if (req.query.projectId) q = q.eq("project_id", String(req.query.projectId));
    if (req.query.agentSlug) q = q.eq("agent_slug", String(req.query.agentSlug));
    const { data, error } = await q;
    if (error) throw error;
    res.json(data ?? []);
  } catch (e) { serverError(res, e); }
});

/* GET /api/agents/threads/:id/messages → AgentMessage[] (raw array) */
agentsRouter.get("/threads/:id/messages", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agent_thread_messages")
      .select("id, thread_id, role, agent_slug, parts, tokens_in, tokens_out, model, created_at")
      .eq("thread_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!data) return notFound(res, "Thread not found");
    res.json(data);
  } catch (e) { serverError(res, e); }
});

/* GET /api/agents/:slug/memory?projectId=&scope=&limit= → AgentMemoryRow[] (raw array) */
agentsRouter.get("/:slug/memory", async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!isAgentSlug(slug)) return badRequest(res, "Invalid agent slug");
    let q = supabase
      .from("agent_memory")
      .select("id, agent_slug, scope, key, content, importance, created_at, accessed_at")
      .eq("agent_slug", slug)
      .order("importance", { ascending: false });
    if (req.query.scope) q = q.eq("scope", String(req.query.scope));
    if (req.query.projectId) q = q.eq("project_id", String(req.query.projectId));
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 100;
    q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data ?? []);
  } catch (e) { serverError(res, e); }
});

/* POST /api/agents/:slug/memory → { id } */
agentsRouter.post("/:slug/memory", async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!isAgentSlug(slug)) return badRequest(res, "Invalid agent slug");
    const { scope, content, key, importance, projectId } = req.body ?? {};
    if (!scope || !content) return badRequest(res, "scope and content required");
    const { data, error } = await supabase
      .from("agent_memory")
      .insert({
        agent_slug: slug, scope, content, key: key ?? null,
        importance: importance ?? 0.5, project_id: projectId ?? null,
      })
      .select("id").single();
    if (error) throw error;
    res.json({ id: data.id });
  } catch (e) { serverError(res, e); }
});

/* GET /api/agents/activity?projectId=&agentSlug=&limit= → AgentActivity[] (raw array) */
agentsRouter.get("/activity", async (req, res) => {
  try {
    let q = supabase
      .from("agent_activity")
      .select("id, agent_slug, project_id, thread_id, kind, summary, tokens_in, tokens_out, cost_usd, duration_ms, status, created_at")
      .order("created_at", { ascending: false });
    if (req.query.projectId) q = q.eq("project_id", String(req.query.projectId));
    if (req.query.agentSlug) q = q.eq("agent_slug", String(req.query.agentSlug));
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 100;
    q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data ?? []);
  } catch (e) { serverError(res, e); }
});

/* GET /api/agents/activity/stream → SSE
   Each event: `data: <AgentActivity JSON>\n\n`
   Heartbeat every 25s */
agentsRouter.get("/activity/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (row: unknown) => res.write(`data: ${JSON.stringify(row)}\n\n`);
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25_000);

  const channel = supabase
    .channel(`activity-stream-${randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "agent_activity" },
      (payload) => send(payload.new),
    )
    .subscribe();

  req.on("close", () => {
    clearInterval(heartbeat);
    supabase.removeChannel(channel);
    res.end();
  });
});

/* POST /api/agents/router/route
   body: { projectId, task, context? }
   resp: { agent, reason, estimatedCost } */
agentsRouter.post("/router/route", async (req, res) => {
  try {
    const { task } = req.body ?? {};
    if (!task) return badRequest(res, "task required");

    // Deterministic classification → which agent should handle it.
    // Actual model choice for that agent is read from agent_registry.routing_config
    // by the agent's own worker — DO NOT hardcode models here.
    const t = String(task).toLowerCase();
    let agent: AgentSlug = "jimmy";
    let reason = "Default: general autonomous work routes to Jimmy";
    if (/(bug|error|crash|fail|debug|investigate|security|audit|scan)/.test(t)) {
      agent = "sherlock";
      reason = "Bug/security/investigation keyword → Sherlock";
    } else if (/(deploy|ship|release|publish)/.test(t)) {
      agent = "jimmy";
      reason = "Deploy/release → Jimmy (CEO autopilot)";
    }

    // Cost estimate is a rough hint; real cost recorded in agent_activity after run.
    res.json({ agent, reason, estimatedCost: 0 });
  } catch (e) { serverError(res, e); }
});

export default agentsRouter;
