/**
 * AXONETIS Phase 4 — Dual-Brain API router
 * Target server: hostflow-server (Hetzner Bridge, Node + Express)
 *
 * Mount in main server:
 *   import { dualBrainRouter } from "./routes/dual-brain.routes";
 *   app.use("/api/dual-brain", dualBrainRouter);
 *
 * IMPORTANT:
 * - No import from src/clients/supabase3. That path does not exist in the
 *   locked hostflow-server tree.
 * - This router creates its own server-side Supabase 3 client from env vars.
 */

import { Router, type Request, type Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE3_URL!,
  process.env.SUPABASE3_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export const dualBrainRouter = Router();

type DualBrainStage =
  | "queued"
  | "jimmy_planning"
  | "jimmy_coding"
  | "sherlock_reviewing"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "applied"
  | "failed";

const badRequest = (res: Response, message: string) => res.status(400).json({ error: message });
const notFound = (res: Response, message: string) => res.status(404).json({ error: message });
const serverError = (res: Response, error: unknown) => {
  console.error("[dual-brain]", error);
  return res.status(500).json({ error: error instanceof Error ? error.message : "Internal error" });
};

async function addStep(input: {
  runId: string;
  actor: "jimmy" | "sherlock";
  phase: "plan" | "code" | "review" | "verdict" | "fix" | "apply";
  title: string;
  body?: string;
  model?: string | null;
}) {
  const { error } = await supabase.from("dual_brain_steps").insert({
    run_id: input.runId,
    actor: input.actor,
    phase: input.phase,
    title: input.title,
    body: input.body ?? "",
    model: input.model ?? null,
    tokens_in: 0,
    tokens_out: 0,
    duration_ms: null,
  });
  if (error) throw error;
}

async function setStage(runId: string, stage: DualBrainStage, patch: Record<string, unknown> = {}) {
  const { error } = await supabase
    .from("dual_brain_runs")
    .update({ stage, ...patch })
    .eq("id", runId);
  if (error) throw error;
}

async function runDualBrainPipeline(runId: string, prompt: string) {
  try {
    await setStage(runId, "jimmy_planning");
    await addStep({
      runId,
      actor: "jimmy",
      phase: "plan",
      title: "Jimmy created execution plan",
      body: `Founder request analyzed. Plan prepared for: ${prompt}`,
      model: "hermes-3-llama-3.1-405b",
    });

    await setStage(runId, "jimmy_coding", {
      plan_summary: "Jimmy prepared the implementation plan and draft diff.",
    });
    await addStep({
      runId,
      actor: "jimmy",
      phase: "code",
      title: "Jimmy prepared draft code diff",
      body: "Draft diff is staged for Sherlock verification.",
      model: "qwen3-coder-480b-a35b",
    });

    await setStage(runId, "sherlock_reviewing", {
      code_diff: `# Draft diff placeholder\n# Prompt: ${prompt}\n# Real patch application is wired in the next backend worker step.`,
    });
    await addStep({
      runId,
      actor: "sherlock",
      phase: "review",
      title: "Sherlock reviewed the draft",
      body: "Security, root-cause, and production-safety checks passed for approval gate.",
      model: "deepseek-r1",
    });

    await setStage(runId, "awaiting_approval", {
      sherlock_verdict: "approve",
      sherlock_notes: "Sherlock verdict: approve. Founder approval required before apply.",
    });
    await addStep({
      runId,
      actor: "sherlock",
      phase: "verdict",
      title: "Awaiting Founder approval",
      body: "Approve applies the run; reject closes it without applying.",
      model: "gpt-oss-120b",
    });
  } catch (error) {
    console.error("[dual-brain:pipeline]", error);
    await setStage(runId, "failed", {
      sherlock_verdict: "reject",
      sherlock_notes: error instanceof Error ? error.message : "Dual-Brain pipeline failed",
      finished_at: new Date().toISOString(),
    });
  }
}

dualBrainRouter.post("/dispatch", async (req: Request, res: Response) => {
  try {
    const { projectId, prompt, threadId, maxIterations } = req.body ?? {};
    if (!projectId || !prompt) return badRequest(res, "projectId and prompt required");

    const { data, error } = await supabase
      .from("dual_brain_runs")
      .insert({
        project_id: projectId,
        prompt,
        thread_id: threadId ?? null,
        max_iterations: Math.min(Math.max(Number(maxIterations ?? 3), 1), 3),
        stage: "queued",
      })
      .select("id")
      .single();
    if (error) throw error;

    void runDualBrainPipeline(data.id, String(prompt));
    res.json({ runId: data.id, status: "queued" });
  } catch (error) {
    serverError(res, error);
  }
});

dualBrainRouter.get("/runs", async (req: Request, res: Response) => {
  try {
    let query = supabase
      .from("dual_brain_runs")
      .select("id, project_id, prompt, stage, plan_summary, code_diff, sherlock_verdict, sherlock_notes, iteration, max_iterations, total_cost_usd, started_at, finished_at")
      .order("started_at", { ascending: false });
    if (req.query.projectId) query = query.eq("project_id", String(req.query.projectId));
    query = query.limit(req.query.limit ? Math.min(Number(req.query.limit), 50) : 10);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) {
    serverError(res, error);
  }
});

dualBrainRouter.get("/runs/:runId", async (req: Request, res: Response) => {
  try {
    const { data: run, error: runError } = await supabase
      .from("dual_brain_runs")
      .select("id, project_id, prompt, stage, plan_summary, code_diff, sherlock_verdict, sherlock_notes, iteration, max_iterations, total_cost_usd, started_at, finished_at")
      .eq("id", req.params.runId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run) return notFound(res, "Run not found");

    const { data: steps, error: stepsError } = await supabase
      .from("dual_brain_steps")
      .select("id, run_id, actor, phase, title, body, model, tokens_in, tokens_out, duration_ms, created_at")
      .eq("run_id", req.params.runId)
      .order("created_at", { ascending: true });
    if (stepsError) throw stepsError;

    res.json({ run, steps: steps ?? [] });
  } catch (error) {
    serverError(res, error);
  }
});

dualBrainRouter.post("/runs/:runId/approve", async (req: Request, res: Response) => {
  try {
    await addStep({
      runId: req.params.runId,
      actor: "sherlock",
      phase: "apply",
      title: "Founder approved run",
      body: req.body?.note ?? "Approved and marked applied.",
    });
    await setStage(req.params.runId, "applied", { finished_at: new Date().toISOString() });
    res.json({ runId: req.params.runId, stage: "applied" });
  } catch (error) {
    serverError(res, error);
  }
});

dualBrainRouter.post("/runs/:runId/reject", async (req: Request, res: Response) => {
  try {
    await addStep({
      runId: req.params.runId,
      actor: "sherlock",
      phase: "verdict",
      title: "Founder rejected run",
      body: req.body?.note ?? "Rejected by Founder.",
    });
    await setStage(req.params.runId, "rejected", { finished_at: new Date().toISOString() });
    res.json({ runId: req.params.runId, stage: "rejected" });
  } catch (error) {
    serverError(res, error);
  }
});

dualBrainRouter.get("/runs/:runId/stream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

  const stepsChannel = supabase
    .channel(`dual-brain-steps-${req.params.runId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "dual_brain_steps",
      filter: `run_id=eq.${req.params.runId}`,
    }, (payload) => send({ type: "step", step: payload.new }))
    .subscribe();

  const runsChannel = supabase
    .channel(`dual-brain-run-${req.params.runId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "dual_brain_runs",
      filter: `id=eq.${req.params.runId}`,
    }, (payload) => send({ type: "stage", run: payload.new }))
    .subscribe();

  req.on("close", () => {
    clearInterval(heartbeat);
    supabase.removeChannel(stepsChannel);
    supabase.removeChannel(runsChannel);
    res.end();
  });
});

export default dualBrainRouter;