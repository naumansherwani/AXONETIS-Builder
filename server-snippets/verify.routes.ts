/**
 * AXONETIS Phase 3.10.2 sub-step 2 — Self-Verification Loop routes
 * Target file: /root/hostflow-server/src/routes/verify.routes.ts
 * Mount:       app.use("/rpc", verifyRouter)   // routes are /rpc/verify.*
 *
 * Contract (frontend 1:1, raw JSON — NO {success,data} wrapper):
 *   POST /rpc/verify.start        { threadId, projectId?, target?, agent?, max_attempts?, checks[] } -> { verify_id }
 *   POST /rpc/verify.check.update { verify_id, check_id, status, detail?, duration_ms? } -> { ok: true }
 *   POST /rpc/verify.attempt      { verify_id, attempt, status?, fix_summary? } -> { ok: true }
 *   POST /rpc/verify.finish       { verify_id, status, verdict?, fix_summary? } -> { ok: true }
 *   GET  /rpc/verify.get?verify_id=… -> full verification part
 *
 * Side-effect: har write `verification` part ko `agent_thread_messages.parts`
 * par re-emit karta hai, jis se Supabase 3 Realtime SelfVerifyLoop UI turant
 * refresh kar deta hai (koi polling nahi).
 */
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE3_URL as string,
  process.env.SUPABASE3_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } },
);

export const verifyRouter = Router();

const CHECK_STATUS = ["pending", "running", "pass", "fail", "skipped"];
const CHECK_KIND = ["logic", "security", "performance", "build", "test"];
const VERIFY_STATUS = ["running", "pass", "fail", "retrying"];

async function loadPart(verifyId: string) {
  const { data: run } = await sb
    .from("agent_verifications")
    .select("id, thread_id, message_id, target, agent, attempt, max_attempts, status, verdict, fix_summary")
    .eq("id", verifyId)
    .maybeSingle();
  if (!run) return null;
  const { data: checks } = await sb
    .from("agent_verification_checks")
    .select("check_key, label, kind, status, detail, duration_ms")
    .eq("verification_id", verifyId)
    .order("sort_order", { ascending: true });
  return {
    run,
    part: {
      type: "verification",
      verify_id: run.id,
      target: run.target ?? undefined,
      agent: run.agent ?? undefined,
      attempt: run.attempt ?? 1,
      max_attempts: run.max_attempts ?? 1,
      status: run.status,
      verdict: run.verdict ?? undefined,
      fix_summary: run.fix_summary ?? undefined,
      checks: (checks ?? []).map((c: any) => ({
        id: c.check_key,
        label: c.label,
        kind: c.kind,
        status: c.status,
        detail: c.detail ?? undefined,
        duration_ms: c.duration_ms ?? undefined,
      })),
    },
  };
}

/** Upsert the `verification` part onto a thread message so Realtime pushes it. */
async function emitVerifyPart(verifyId: string) {
  const loaded = await loadPart(verifyId);
  if (!loaded) return;
  const { run, part } = loaded;

  if (run.message_id) {
    const { data: row } = await sb
      .from("agent_thread_messages")
      .select("parts")
      .eq("id", run.message_id)
      .maybeSingle();
    const parts = Array.isArray(row?.parts) ? row!.parts : [];
    const next = [
      ...parts.filter((p: any) => !(p && p.type === "verification" && p.verify_id === run.id)),
      part,
    ];
    await sb.from("agent_thread_messages").update({ parts: next }).eq("id", run.message_id);
    return;
  }

  const { data: inserted } = await sb
    .from("agent_thread_messages")
    .insert({
      thread_id: run.thread_id,
      role: "agent",
      agent_slug: run.agent ?? "sherlock",
      parts: [part],
    })
    .select("id")
    .single();
  if (inserted?.id) {
    await sb.from("agent_verifications").update({ message_id: inserted.id }).eq("id", verifyId);
  }
}

verifyRouter.post("/verify.start", async (req, res) => {
  try {
    const { threadId, projectId, target, agent, max_attempts, checks } = req.body ?? {};
    if (!threadId) return res.status(400).json({ error: "threadId required" });

    const { data: run, error } = await sb
      .from("agent_verifications")
      .insert({
        thread_id: threadId,
        project_id: projectId ?? null,
        target: target ?? null,
        agent: agent ?? "sherlock",
        attempt: 1,
        max_attempts: typeof max_attempts === "number" && max_attempts > 0 ? max_attempts : 3,
        status: "running",
      })
      .select("id")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const list = Array.isArray(checks) ? checks : [];
    if (list.length) {
      await sb.from("agent_verification_checks").insert(
        list.map((c: any, i: number) => ({
          verification_id: run.id,
          check_key: String(c.id ?? `vc-${i}`),
          label: String(c.label ?? "").slice(0, 500),
          kind: CHECK_KIND.includes(c.kind) ? c.kind : "logic",
          status: CHECK_STATUS.includes(c.status) ? c.status : "pending",
          detail: c.detail ?? null,
          sort_order: i,
        })),
      );
    }
    await emitVerifyPart(run.id);
    return res.json({ verify_id: run.id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "verify.start failed" });
  }
});

verifyRouter.post("/verify.check.update", async (req, res) => {
  try {
    const { verify_id, check_id, status, detail, duration_ms } = req.body ?? {};
    if (!verify_id || !check_id)
      return res.status(400).json({ error: "verify_id and check_id required" });
    if (status && !CHECK_STATUS.includes(status))
      return res.status(400).json({ error: "invalid status" });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) patch.status = status;
    if (typeof detail === "string") patch.detail = detail;
    if (typeof duration_ms === "number") patch.duration_ms = duration_ms;

    const { error } = await sb
      .from("agent_verification_checks")
      .update(patch)
      .eq("verification_id", verify_id)
      .eq("check_key", String(check_id));
    if (error) return res.status(500).json({ error: error.message });

    await emitVerifyPart(verify_id);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "verify.check.update failed" });
  }
});

verifyRouter.post("/verify.attempt", async (req, res) => {
  try {
    const { verify_id, attempt, status, fix_summary } = req.body ?? {};
    if (!verify_id || typeof attempt !== "number")
      return res.status(400).json({ error: "verify_id and numeric attempt required" });
    if (status && !VERIFY_STATUS.includes(status))
      return res.status(400).json({ error: "invalid status" });

    const patch: Record<string, unknown> = {
      attempt,
      status: status ?? "retrying",
      updated_at: new Date().toISOString(),
    };
    if (typeof fix_summary === "string") patch.fix_summary = fix_summary;

    const { error } = await sb.from("agent_verifications").update(patch).eq("id", verify_id);
    if (error) return res.status(500).json({ error: error.message });

    // new pass → reset checks to pending so the UI shows a fresh run
    await sb
      .from("agent_verification_checks")
      .update({ status: "pending", duration_ms: null, updated_at: new Date().toISOString() })
      .eq("verification_id", verify_id);

    await emitVerifyPart(verify_id);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "verify.attempt failed" });
  }
});

verifyRouter.post("/verify.finish", async (req, res) => {
  try {
    const { verify_id, status, verdict, fix_summary } = req.body ?? {};
    if (!verify_id || !["pass", "fail"].includes(status))
      return res.status(400).json({ error: "verify_id and status pass|fail required" });

    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (typeof verdict === "string") patch.verdict = verdict;
    if (typeof fix_summary === "string") patch.fix_summary = fix_summary;

    const { error } = await sb.from("agent_verifications").update(patch).eq("id", verify_id);
    if (error) return res.status(500).json({ error: error.message });
    await emitVerifyPart(verify_id);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "verify.finish failed" });
  }
});

verifyRouter.get("/verify.get", async (req, res) => {
  try {
    const verifyId = String(req.query.verify_id ?? "");
    if (!verifyId) return res.status(400).json({ error: "verify_id required" });
    const loaded = await loadPart(verifyId);
    if (!loaded) return res.status(404).json({ error: "verification not found" });
    return res.json(loaded.part);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "verify.get failed" });
  }
});

export default verifyRouter;
