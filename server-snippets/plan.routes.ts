/**
 * AXONETIS Phase 3.10.2 — Planning Tree server routes (hostflow-server bridge, :8090)
 * Target file: /root/hostflow-server/src/routes/plan.routes.ts
 * Mount:       app.use("/rpc", planRouter)   // routes are /rpc/plan.*
 *
 * Contract (frontend 1:1, raw JSON — NO {success,data} wrapper):
 *   POST /rpc/plan.create      { threadId, projectId, goal, nodes[] } -> { plan_id }
 *   POST /rpc/plan.node.update { plan_id, node_id, status, duration_ms?, cost_usd? } -> { ok: true }
 *   POST /rpc/plan.status      { plan_id, status } -> { ok: true }
 *   GET  /rpc/plan.get?plan_id=… -> { plan_id, goal, status, nodes[] }
 *
 * Side-effect: create + every update ek `plan` part `agent_thread_messages`
 * row par likhta hai, jis se Supabase 3 Realtime turant Planning Tree UI
 * refresh kar deta hai (koi polling nahi).
 */
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE3_URL as string,
  process.env.SUPABASE3_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } },
);

export const planRouter = Router();

type NodeStatus = "pending" | "running" | "done" | "failed" | "skipped";
const NODE_STATUS: NodeStatus[] = ["pending", "running", "done", "failed", "skipped"];
const PLAN_STATUS = ["planning", "running", "done", "failed"];

/** Upsert the `plan` part onto a thread message so Realtime pushes the tree. */
async function emitPlanPart(planId: string) {
  const { data: plan } = await sb
    .from("agent_plans")
    .select("id, thread_id, goal, status, message_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return;
  const { data: nodes } = await sb
    .from("agent_plan_nodes")
    .select("id, title, kind, status, parent_id, detail, agent, tool, cost_usd, duration_ms")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true });

  const part = {
    type: "plan",
    plan_id: plan.id,
    goal: plan.goal,
    status: plan.status,
    nodes: nodes ?? [],
  };

  if (plan.message_id) {
    const { data: row } = await sb
      .from("agent_thread_messages")
      .select("parts")
      .eq("id", plan.message_id)
      .maybeSingle();
    const parts = Array.isArray(row?.parts) ? row!.parts : [];
    const next = [
      ...parts.filter((p: any) => !(p && p.type === "plan" && p.plan_id === plan.id)),
      part,
    ];
    await sb.from("agent_thread_messages").update({ parts: next }).eq("id", plan.message_id);
    return;
  }

  const { data: inserted } = await sb
    .from("agent_thread_messages")
    .insert({
      thread_id: plan.thread_id,
      role: "assistant",
      agent_slug: "jimmy",
      parts: [part],
    })
    .select("id")
    .single();
  if (inserted?.id) {
    await sb.from("agent_plans").update({ message_id: inserted.id }).eq("id", planId);
  }
}

planRouter.post("/plan.create", async (req, res) => {
  try {
    const { threadId, projectId, goal, nodes } = req.body ?? {};
    if (!threadId || !goal) return res.status(400).json({ error: "threadId and goal required" });

    const { data: plan, error } = await sb
      .from("agent_plans")
      .insert({ thread_id: threadId, project_id: projectId ?? null, goal, status: "planning" })
      .select("id")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const list = Array.isArray(nodes) ? nodes : [];
    if (list.length) {
      await sb.from("agent_plan_nodes").insert(
        list.map((n: any, i: number) => ({
          plan_id: plan.id,
          node_key: String(n.id ?? `pn-${i}`),
          title: String(n.title ?? "").slice(0, 500),
          kind: ["task", "verify", "subagent"].includes(n.kind) ? n.kind : "task",
          status: NODE_STATUS.includes(n.status) ? n.status : "pending",
          parent_key: n.parent_id ? String(n.parent_id) : null,
          detail: n.detail ?? null,
          agent: n.agent ?? null,
          tool: n.tool ?? null,
          sort_order: i,
        })),
      );
    }
    await emitPlanPart(plan.id);
    return res.json({ plan_id: plan.id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "plan.create failed" });
  }
});

planRouter.post("/plan.node.update", async (req, res) => {
  try {
    const { plan_id, node_id, status, duration_ms, cost_usd } = req.body ?? {};
    if (!plan_id || !node_id) return res.status(400).json({ error: "plan_id and node_id required" });
    if (status && !NODE_STATUS.includes(status))
      return res.status(400).json({ error: "invalid status" });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) patch.status = status;
    if (typeof duration_ms === "number") patch.duration_ms = duration_ms;
    if (typeof cost_usd === "number") patch.cost_usd = cost_usd;

    const { error } = await sb
      .from("agent_plan_nodes")
      .update(patch)
      .eq("plan_id", plan_id)
      .eq("node_key", String(node_id));
    if (error) return res.status(500).json({ error: error.message });

    await emitPlanPart(plan_id);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "plan.node.update failed" });
  }
});

planRouter.post("/plan.status", async (req, res) => {
  try {
    const { plan_id, status } = req.body ?? {};
    if (!plan_id || !PLAN_STATUS.includes(status))
      return res.status(400).json({ error: "plan_id and valid status required" });
    const { error } = await sb.from("agent_plans").update({ status }).eq("id", plan_id);
    if (error) return res.status(500).json({ error: error.message });
    await emitPlanPart(plan_id);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "plan.status failed" });
  }
});

planRouter.get("/plan.get", async (req, res) => {
  try {
    const planId = String(req.query.plan_id ?? "");
    if (!planId) return res.status(400).json({ error: "plan_id required" });
    const { data: plan } = await sb
      .from("agent_plans")
      .select("id, goal, status")
      .eq("id", planId)
      .maybeSingle();
    if (!plan) return res.status(404).json({ error: "plan not found" });
    const { data: nodes } = await sb
      .from("agent_plan_nodes")
      .select("node_key, title, kind, status, parent_key, detail, agent, tool, cost_usd, duration_ms")
      .eq("plan_id", planId)
      .order("sort_order", { ascending: true });
    return res.json({
      plan_id: plan.id,
      goal: plan.goal,
      status: plan.status,
      nodes: (nodes ?? []).map((n: any) => ({
        id: n.node_key,
        title: n.title,
        kind: n.kind,
        status: n.status,
        parent_id: n.parent_key ?? undefined,
        detail: n.detail ?? undefined,
        agent: n.agent ?? undefined,
        tool: n.tool ?? undefined,
        cost_usd: n.cost_usd ?? undefined,
        duration_ms: n.duration_ms ?? undefined,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "plan.get failed" });
  }
});

export default planRouter;
