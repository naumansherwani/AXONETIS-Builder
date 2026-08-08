/**
 * AXONETIS Phase 3.10.2 sub-step 3 — Sub-Agent Delegation routes
 * Target file: /opt/hostflow-ecosystem/hostflow-server/src/routes/delegate.routes.ts
 * Mount:       app.use("/rpc", delegateRouter)   // routes are /rpc/delegate.*
 *
 * Contract (frontend 1:1, raw JSON — NO {success,data} wrapper):
 *   POST /rpc/delegate.create      { threadId, projectId?, goal?, parent_agent?, messageId?, tasks[] } -> { delegation_id }
 *   POST /rpc/delegate.task.update { delegation_id, task_id, status, summary?, model?, tokens?, duration_ms? } -> { ok: true }
 *   POST /rpc/delegate.finish      { delegation_id, status } -> { ok: true }
 *   GET  /rpc/delegate.get?delegation_id=… -> full delegation part
 *
 * Side-effect: har write `delegation` part ko `agent_thread_messages.parts`
 * par re-emit karta hai — Supabase 3 Realtime se DelegationTree UI turant
 * update ho jata hai (koi polling nahi).
 */
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE3_URL as string,
  process.env.SUPABASE3_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } },
);

export const delegateRouter = Router();

const TASK_STATUS = ["queued", "running", "done", "failed", "cancelled"];
const DELEG_STATUS = ["running", "done", "failed", "cancelled"];

async function loadPart(delegationId: string) {
  const { data: run } = await sb
    .from("agent_delegations")
    .select("id, thread_id, message_id, goal, parent_agent, status")
    .eq("id", delegationId)
    .maybeSingle();
  if (!run) return null;
  const { data: tasks } = await sb
    .from("agent_delegation_tasks")
    .select("id, agent, title, status, model, summary, tokens, duration_ms, sort_order")
    .eq("delegation_id", delegationId)
    .order("sort_order", { ascending: true });
  return {
    run,
    part: {
      type: "delegation",
      delegation_id: run.id,
      parent_agent: run.parent_agent ?? undefined,
      goal: run.goal ?? undefined,
      status: run.status,
      tasks: (tasks ?? []).map((t) => ({
        id: t.id,
        agent: t.agent,
        title: t.title,
        status: t.status,
        model: t.model ?? undefined,
        summary: t.summary ?? undefined,
        tokens: t.tokens ?? undefined,
        duration_ms: t.duration_ms ?? undefined,
      })),
    },
  };
}

/** Re-emit the delegation part on the owning thread message so Realtime pushes it. */
async function emitDelegationPart(delegationId: string) {
  const loaded = await loadPart(delegationId);
  if (!loaded) return;
  const { run, part } = loaded;

  if (run.message_id) {
    const { data: msg } = await sb
      .from("agent_thread_messages")
      .select("id, parts")
      .eq("id", run.message_id)
      .maybeSingle();
    if (msg) {
      const parts = Array.isArray(msg.parts) ? [...msg.parts] : [];
      const idx = parts.findIndex(
        (p: any) => p && p.type === "delegation" && p.delegation_id === delegationId,
      );
      if (idx >= 0) parts[idx] = part;
      else parts.push(part);
      await sb.from("agent_thread_messages").update({ parts }).eq("id", msg.id);
      return;
    }
  }

  const { data: inserted } = await sb
    .from("agent_thread_messages")
    .insert({
      thread_id: run.thread_id,
      role: "assistant",
      agent_slug: run.parent_agent ?? "jimmy",
      parts: [part],
    })
    .select("id")
    .maybeSingle();
  if (inserted?.id) {
    await sb.from("agent_delegations").update({ message_id: inserted.id }).eq("id", delegationId);
  }
}

delegateRouter.post("/delegate.create", async (req, res) => {
  try {
    const { threadId, projectId, goal, parent_agent, messageId, tasks } = req.body ?? {};
    if (!threadId) return res.status(400).json({ error: "threadId required" });
    if (!Array.isArray(tasks) || tasks.length === 0)
      return res.status(400).json({ error: "tasks[] required" });

    const { data: run, error } = await sb
      .from("agent_delegations")
      .insert({
        thread_id: threadId,
        project_id: projectId ?? null,
        message_id: messageId ?? null,
        goal: goal ?? null,
        parent_agent: parent_agent ?? "jimmy",
        status: "running",
      })
      .select("id")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const rows = tasks
      .filter((t: any) => t && typeof t.title === "string" && t.title.trim())
      .map((t: any, i: number) => ({
        delegation_id: run.id,
        agent: typeof t.agent === "string" && t.agent ? t.agent : "advisor",
        title: String(t.title),
        status: TASK_STATUS.includes(t.status) ? t.status : "queued",
        model: t.model ?? null,
        sort_order: typeof t.sort_order === "number" ? t.sort_order : i,
      }));
    if (rows.length === 0) return res.status(400).json({ error: "no valid tasks" });
    const { error: tErr } = await sb.from("agent_delegation_tasks").insert(rows);
    if (tErr) return res.status(500).json({ error: tErr.message });

    await emitDelegationPart(run.id);
    return res.json({ delegation_id: run.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "delegate.create failed" });
  }
});

delegateRouter.post("/delegate.task.update", async (req, res) => {
  try {
    const { delegation_id, task_id, status, summary, model, tokens, duration_ms } = req.body ?? {};
    if (!delegation_id || !task_id)
      return res.status(400).json({ error: "delegation_id and task_id required" });
    if (status && !TASK_STATUS.includes(status))
      return res.status(400).json({ error: `status must be one of ${TASK_STATUS.join(", ")}` });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) patch.status = status;
    if (typeof summary === "string") patch.summary = summary;
    if (typeof model === "string") patch.model = model;
    if (typeof tokens === "number") patch.tokens = tokens;
    if (typeof duration_ms === "number") patch.duration_ms = duration_ms;

    const { error } = await sb
      .from("agent_delegation_tasks")
      .update(patch)
      .eq("id", task_id)
      .eq("delegation_id", delegation_id);
    if (error) return res.status(500).json({ error: error.message });

    await emitDelegationPart(delegation_id);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "delegate.task.update failed" });
  }
});

delegateRouter.post("/delegate.finish", async (req, res) => {
  try {
    const { delegation_id, status } = req.body ?? {};
    if (!delegation_id) return res.status(400).json({ error: "delegation_id required" });
    if (!DELEG_STATUS.includes(status))
      return res.status(400).json({ error: `status must be one of ${DELEG_STATUS.join(", ")}` });

    const { error } = await sb
      .from("agent_delegations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", delegation_id);
    if (error) return res.status(500).json({ error: error.message });

    await emitDelegationPart(delegation_id);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "delegate.finish failed" });
  }
});

delegateRouter.get("/delegate.get", async (req, res) => {
  try {
    const id = String(req.query.delegation_id ?? "");
    if (!id) return res.status(400).json({ error: "delegation_id required" });
    const loaded = await loadPart(id);
    if (!loaded) return res.status(404).json({ error: "delegation not found" });
    return res.json(loaded.part);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "delegate.get failed" });
  }
});

export default delegateRouter;
