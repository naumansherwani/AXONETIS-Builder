/**
 * AXONETIS Phase 3.10.2 — LAST PIECE: Jimmy planning loop ↔ 3 UIs (live join)
 * Target file: /opt/hostflow-ecosystem/hostflow-server/src/routes/orchestrate.routes.ts
 * Mount:       app.use("/rpc", orchestrateRouter)   // routes are /rpc/orchestrate.*
 *
 * Yeh route Planning Tree + Sub-Agent Delegation + Self-Verify — teenon ko EK
 * thread message par bind karta hai, isliye teen UI ek hi run ke andar live
 * update hoti hain (Supabase 3 Realtime, koi polling nahi).
 *
 * Contract (raw JSON, frontend 1:1 — NO {success,data} wrapper):
 *   POST /rpc/orchestrate.begin
 *     { threadId, projectId?, goal, nodes?[{title,kind?,agent?,tool?,detail?}],
 *       tasks?[{agent?,title,model?}], checks?[{key,label?}], max_attempts? }
 *     -> { message_id, plan_id, delegation_id, verify_id }
 *
 *   POST /rpc/orchestrate.advance
 *     { message_id, plan?{node_id,status,duration_ms?,cost_usd?},
 *       task?{task_id,status,summary?,model?,tokens?,duration_ms?},
 *       check?{key,status,detail?} }
 *     -> { ok: true }
 *
 *   POST /rpc/orchestrate.finish
 *     { message_id, plan_status?, delegation_status?, verify_status?, verdict?, fix_summary? }
 *     -> { ok: true }
 *
 *   GET  /rpc/orchestrate.get?message_id=…  -> { parts: [...] }
 *
 * Tables reused (koi nayi table nahi — NO DUPLICATE):
 *   agent_plans / agent_plan_nodes            (3.10.2 sub-step 1)
 *   agent_verifications / agent_verification_checks (sub-step 2)
 *   agent_delegations / agent_delegation_tasks (sub-step 3)
 */
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE3_URL as string,
  process.env.SUPABASE3_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } },
);

export const orchestrateRouter = Router();

/* ------------------------------------------------------------------ helpers */

async function planPart(planId: string) {
  const { data: plan } = await sb
    .from("agent_plans")
    .select("id, goal, status")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return null;
  const { data: nodes } = await sb
    .from("agent_plan_nodes")
    .select("id, title, kind, status, parent_id, detail, agent, tool, cost_usd, duration_ms")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true });
  return { type: "plan", plan_id: plan.id, goal: plan.goal, status: plan.status, nodes: nodes ?? [] };
}

async function delegationPart(delegationId: string) {
  const { data: run } = await sb
    .from("agent_delegations")
    .select("id, goal, parent_agent, status")
    .eq("id", delegationId)
    .maybeSingle();
  if (!run) return null;
  const { data: tasks } = await sb
    .from("agent_delegation_tasks")
    .select("id, agent, title, status, model, summary, tokens, duration_ms")
    .eq("delegation_id", delegationId)
    .order("sort_order", { ascending: true });
  return {
    type: "delegation",
    delegation_id: run.id,
    parent_agent: run.parent_agent ?? undefined,
    goal: run.goal ?? undefined,
    status: run.status,
    tasks: tasks ?? [],
  };
}

async function verificationPart(verifyId: string) {
  const { data: v } = await sb
    .from("agent_verifications")
    .select("id, target, agent, attempt, max_attempts, status, verdict, fix_summary")
    .eq("id", verifyId)
    .maybeSingle();
  if (!v) return null;
  const { data: checks } = await sb
    .from("agent_verification_checks")
    .select("id, key, label, status, detail")
    .eq("verification_id", verifyId)
    .order("sort_order", { ascending: true });
  return {
    type: "verification",
    verify_id: v.id,
    target: v.target ?? undefined,
    agent: v.agent ?? "sherlock",
    attempt: v.attempt ?? 1,
    max_attempts: v.max_attempts ?? 3,
    status: v.status,
    verdict: v.verdict ?? undefined,
    fix_summary: v.fix_summary ?? undefined,
    checks: checks ?? [],
  };
}

/** Rebuild all three parts on the owning message → one Realtime push. */
async function emitAll(messageId: string) {
  const { data: msg } = await sb
    .from("agent_thread_messages")
    .select("id, parts")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return;
  const parts: any[] = Array.isArray(msg.parts) ? [...msg.parts] : [];

  const ids = {
    plan: parts.find((p) => p?.type === "plan")?.plan_id as string | undefined,
    delegation: parts.find((p) => p?.type === "delegation")?.delegation_id as string | undefined,
    verify: parts.find((p) => p?.type === "verification")?.verify_id as string | undefined,
  };

  const fresh = [
    ids.plan ? await planPart(ids.plan) : null,
    ids.delegation ? await delegationPart(ids.delegation) : null,
    ids.verify ? await verificationPart(ids.verify) : null,
  ].filter(Boolean) as any[];

  for (const part of fresh) {
    const idx = parts.findIndex((p) => p?.type === part.type);
    if (idx >= 0) parts[idx] = part;
    else parts.push(part);
  }
  await sb.from("agent_thread_messages").update({ parts }).eq("id", messageId);
}

/* -------------------------------------------------------------------- begin */

orchestrateRouter.post("/orchestrate.begin", async (req, res) => {
  try {
    const { threadId, projectId, goal, nodes, tasks, checks, max_attempts } = req.body ?? {};
    if (!threadId) return res.status(400).json({ error: "threadId required" });
    if (!goal || typeof goal !== "string")
      return res.status(400).json({ error: "goal required" });

    // 1) message row (owner of all three parts)
    const { data: msg, error: mErr } = await sb
      .from("agent_thread_messages")
      .insert({ thread_id: threadId, role: "assistant", agent_slug: "jimmy", parts: [] })
      .select("id")
      .single();
    if (mErr) return res.status(500).json({ error: mErr.message });

    // 2) plan
    const { data: plan, error: pErr } = await sb
      .from("agent_plans")
      .insert({
        thread_id: threadId,
        project_id: projectId ?? null,
        message_id: msg.id,
        goal,
        status: "running",
      })
      .select("id")
      .single();
    if (pErr) return res.status(500).json({ error: pErr.message });

    const nodeRows = (Array.isArray(nodes) ? nodes : [])
      .filter((n: any) => n && typeof n.title === "string" && n.title.trim())
      .map((n: any, i: number) => ({
        plan_id: plan.id,
        title: String(n.title),
        kind: typeof n.kind === "string" ? n.kind : "task",
        status: "pending",
        agent: n.agent ?? null,
        tool: n.tool ?? null,
        detail: n.detail ?? null,
        sort_order: i,
      }));
    if (nodeRows.length) await sb.from("agent_plan_nodes").insert(nodeRows);

    // 3) delegation (optional)
    let delegationId: string | null = null;
    const taskList = (Array.isArray(tasks) ? tasks : []).filter(
      (t: any) => t && typeof t.title === "string" && t.title.trim(),
    );
    if (taskList.length) {
      const { data: run, error: dErr } = await sb
        .from("agent_delegations")
        .insert({
          thread_id: threadId,
          project_id: projectId ?? null,
          message_id: msg.id,
          goal,
          parent_agent: "jimmy",
          status: "running",
        })
        .select("id")
        .single();
      if (dErr) return res.status(500).json({ error: dErr.message });
      delegationId = run.id;
      await sb.from("agent_delegation_tasks").insert(
        taskList.map((t: any, i: number) => ({
          delegation_id: run.id,
          agent: t.agent ?? "advisor",
          title: String(t.title),
          status: "queued",
          model: t.model ?? null,
          sort_order: i,
        })),
      );
    }

    // 4) verification (optional)
    let verifyId: string | null = null;
    const checkList = (Array.isArray(checks) ? checks : []).filter(
      (c: any) => c && typeof c.key === "string" && c.key.trim(),
    );
    if (checkList.length) {
      const { data: v, error: vErr } = await sb
        .from("agent_verifications")
        .insert({
          thread_id: threadId,
          project_id: projectId ?? null,
          message_id: msg.id,
          target: goal,
          agent: "sherlock",
          attempt: 1,
          max_attempts: typeof max_attempts === "number" ? max_attempts : 3,
          status: "running",
        })
        .select("id")
        .single();
      if (vErr) return res.status(500).json({ error: vErr.message });
      verifyId = v.id;
      await sb.from("agent_verification_checks").insert(
        checkList.map((c: any, i: number) => ({
          verification_id: v.id,
          key: String(c.key),
          label: c.label ?? String(c.key),
          status: "pending",
          sort_order: i,
        })),
      );
    }

    // seed parts, then emit
    const seed: any[] = [{ type: "plan", plan_id: plan.id }];
    if (delegationId) seed.push({ type: "delegation", delegation_id: delegationId });
    if (verifyId) seed.push({ type: "verification", verify_id: verifyId });
    await sb.from("agent_thread_messages").update({ parts: seed }).eq("id", msg.id);
    await emitAll(msg.id);

    return res.json({
      message_id: msg.id,
      plan_id: plan.id,
      delegation_id: delegationId,
      verify_id: verifyId,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "orchestrate.begin failed" });
  }
});

/* ------------------------------------------------------------------ advance */

orchestrateRouter.post("/orchestrate.advance", async (req, res) => {
  try {
    const { message_id, plan, task, check } = req.body ?? {};
    if (!message_id) return res.status(400).json({ error: "message_id required" });

    if (plan?.node_id) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (plan.status) patch.status = plan.status;
      if (typeof plan.duration_ms === "number") patch.duration_ms = plan.duration_ms;
      if (typeof plan.cost_usd === "number") patch.cost_usd = plan.cost_usd;
      await sb.from("agent_plan_nodes").update(patch).eq("id", plan.node_id);
    }

    if (task?.task_id) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (task.status) patch.status = task.status;
      if (typeof task.summary === "string") patch.summary = task.summary;
      if (typeof task.model === "string") patch.model = task.model;
      if (typeof task.tokens === "number") patch.tokens = task.tokens;
      if (typeof task.duration_ms === "number") patch.duration_ms = task.duration_ms;
      await sb.from("agent_delegation_tasks").update(patch).eq("id", task.task_id);
    }

    if (check?.key) {
      const { data: row } = await sb
        .from("agent_thread_messages")
        .select("parts")
        .eq("id", message_id)
        .maybeSingle();
      const vid = (Array.isArray(row?.parts) ? row!.parts : []).find(
        (p: any) => p?.type === "verification",
      )?.verify_id as string | undefined;
      if (vid) {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (check.status) patch.status = check.status;
        if (typeof check.detail === "string") patch.detail = check.detail;
        await sb
          .from("agent_verification_checks")
          .update(patch)
          .eq("verification_id", vid)
          .eq("key", String(check.key));
      }
    }

    await emitAll(message_id);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "orchestrate.advance failed" });
  }
});

/* ------------------------------------------------------------------- finish */

orchestrateRouter.post("/orchestrate.finish", async (req, res) => {
  try {
    const { message_id, plan_status, delegation_status, verify_status, verdict, fix_summary } =
      req.body ?? {};
    if (!message_id) return res.status(400).json({ error: "message_id required" });

    const { data: row } = await sb
      .from("agent_thread_messages")
      .select("parts")
      .eq("id", message_id)
      .maybeSingle();
    const parts: any[] = Array.isArray(row?.parts) ? row!.parts : [];
    const planId = parts.find((p) => p?.type === "plan")?.plan_id;
    const delegationId = parts.find((p) => p?.type === "delegation")?.delegation_id;
    const verifyId = parts.find((p) => p?.type === "verification")?.verify_id;
    const now = new Date().toISOString();

    if (planId)
      await sb
        .from("agent_plans")
        .update({ status: plan_status ?? "done", updated_at: now })
        .eq("id", planId);
    if (delegationId)
      await sb
        .from("agent_delegations")
        .update({ status: delegation_status ?? "done", updated_at: now })
        .eq("id", delegationId);
    if (verifyId) {
      const patch: Record<string, unknown> = { status: verify_status ?? "passed", updated_at: now };
      if (typeof verdict === "string") patch.verdict = verdict;
      if (typeof fix_summary === "string") patch.fix_summary = fix_summary;
      await sb.from("agent_verifications").update(patch).eq("id", verifyId);
    }

    await emitAll(message_id);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "orchestrate.finish failed" });
  }
});

/* ---------------------------------------------------------------------- get */

orchestrateRouter.get("/orchestrate.get", async (req, res) => {
  try {
    const id = String(req.query.message_id ?? "");
    if (!id) return res.status(400).json({ error: "message_id required" });
    const { data: row } = await sb
      .from("agent_thread_messages")
      .select("parts")
      .eq("id", id)
      .maybeSingle();
    if (!row) return res.status(404).json({ error: "message not found" });
    return res.json({ parts: Array.isArray(row.parts) ? row.parts : [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "orchestrate.get failed" });
  }
});

export default orchestrateRouter;
