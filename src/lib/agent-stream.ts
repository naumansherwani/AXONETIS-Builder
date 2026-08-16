/**
 * Phase A.1 — Jimmy/Sherlock chat Realtime bridge.
 *
 * Subscribes to Supabase 3 `agent_thread_messages` INSERTs scoped to a
 * single `thread_id`. Returns an unsubscribe function. Used by the Unified
 * Build Chat so assistant + Sherlock replies appear live (no polling) the
 * moment the `axonetis-builder` worker writes the row.
 *
 * Note: Phase A.1 streams at message granularity (one row = one assistant
 * turn). Token-level SSE is Phase 3.10. This is enough to migrate Jimmy +
 * Sherlock OFF Supabase 1 and onto Supabase 3 today.
 */
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";
import type { AgentMessage, AgentSlug } from "@/lib/hostflow-api";

export type AgentMessageRow = AgentMessage;

export interface ThreadStreamHandlers {
  /** New row inserted by the axonetis-builder worker (assistant / tool / sherlock). */
  onMessage: (row: AgentMessageRow) => void;
  /** Optional: surface bridge / channel errors to the UI. */
  onError?: (err: unknown) => void;
}

/**
 * Subscribe to a single thread. Returns unsubscribe.
 * Filtered server-side by `thread_id=eq.<id>` so we only get rows for this chat.
 */
export function subscribeThread(threadId: string, handlers: ThreadStreamHandlers): () => void {
  if (!SUPABASE3_READY) {
    console.warn("[agent-stream] Supabase 3 not configured — skipping Realtime subscription");
    return () => {};
  }
  const channel = supabase3
    .channel(`agent-thread-${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "agent_thread_messages",
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        try {
          handlers.onMessage(payload.new as AgentMessageRow);
        } catch (err) {
          handlers.onError?.(err);
        }
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        handlers.onError?.(new Error(`Realtime channel ${status}`));
      }
    });

  return () => {
    void supabase3.removeChannel(channel);
  };
}

/** Pull historic messages for a thread (used on mount / project switch). */
export async function fetchThreadMessages(threadId: string): Promise<AgentMessageRow[]> {
  if (!SUPABASE3_READY) return [];
  // Try with parent_message_id first; fall back if server DB hasn't migrated yet.
  const fullCols =
    "id, thread_id, parent_message_id, role, agent_slug, parts, tokens_in, tokens_out, model, created_at";
  const baseCols =
    "id, thread_id, role, agent_slug, parts, tokens_in, tokens_out, model, created_at";
  let { data, error } = await supabase3
    .from("agent_thread_messages")
    .select(fullCols)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error && /parent_message_id/.test(error.message)) {
    const retry = await supabase3
      .from("agent_thread_messages")
      .select(baseCols)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(500);
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error) {
    console.warn("[agent-stream] fetchThreadMessages failed:", error.message);
    return [];
  }
  return (data ?? []) as AgentMessageRow[];
}

/** Extract first text part from an AgentMessage (for the simple chat UI). */
export function extractText(row: AgentMessageRow): string {
  if (!Array.isArray(row.parts)) return "";
  for (const p of row.parts) {
    if (p && typeof p === "object" && p.type === "text" && typeof p.text === "string") {
      return cleanAgentText(p.text);
    }
  }
  return "";
}

/**
 * 3.9.1 — Extract structured tool_call / diff parts from an AgentMessage.
 * Server contract (Rust runtime):
 *   { type: "tool_call", id, name, args, status, output?, cost_usd?, duration_ms?, error? }
 *   { type: "diff",      diff_id?, path, old, new, language? }
 * Returns empty arrays when the row has no structured parts (no dummy data).
 */
export function extractStructured(row: AgentMessageRow): {
  toolCalls: import("@/components/builder/ToolCallBubble").ToolCallPart[];
  diffs: import("@/components/builder/DiffPreview").DiffPart[];
  plans: import("@/components/builder/PlanningTree").PlanPart[];
  verifications: import("@/components/builder/SelfVerifyLoop").VerificationPart[];
  delegations: import("@/components/builder/DelegationTree").DelegationPart[];
} {
  const toolCalls: import("@/components/builder/ToolCallBubble").ToolCallPart[] = [];
  const diffs: import("@/components/builder/DiffPreview").DiffPart[] = [];
  const plans: import("@/components/builder/PlanningTree").PlanPart[] = [];
  const verifications: import("@/components/builder/SelfVerifyLoop").VerificationPart[] = [];
  const delegations: import("@/components/builder/DelegationTree").DelegationPart[] = [];
  if (!Array.isArray(row.parts)) return { toolCalls, diffs, plans, verifications, delegations };
  for (const p of row.parts) {
    if (!p || typeof p !== "object") continue;
    const rec = p as Record<string, unknown>;
    if (rec.type === "tool_call" && typeof rec.name === "string") {
      const status = (
        typeof rec.status === "string" ? rec.status : "queued"
      ) as import("@/components/builder/ToolCallBubble").ToolCallStatus;
      toolCalls.push({
        id: String(rec.id ?? `${row.id}-tc-${toolCalls.length}`),
        name: rec.name,
        args: rec.args,
        status: ["queued", "running", "success", "error"].includes(status) ? status : "queued",
        output: rec.output,
        cost_usd: typeof rec.cost_usd === "number" ? rec.cost_usd : undefined,
        duration_ms: typeof rec.duration_ms === "number" ? rec.duration_ms : undefined,
        error: typeof rec.error === "string" ? rec.error : undefined,
      });
    } else if (rec.type === "diff" && typeof rec.path === "string") {
      diffs.push({
        diff_id: typeof rec.diff_id === "string" ? rec.diff_id : undefined,
        path: rec.path,
        old: typeof rec.old === "string" ? rec.old : "",
        new: typeof rec.new === "string" ? rec.new : "",
        language: typeof rec.language === "string" ? rec.language : undefined,
        sherlock:
          rec.sherlock === "pass" || rec.sherlock === "fail" || rec.sherlock === "retry"
            ? rec.sherlock
            : undefined,
      });
    } else if (rec.type === "plan") {
      const plan = parsePlanPart(rec);
      if (plan) plans.push(plan);
    } else if (rec.type === "verification") {
      const v = parseVerificationPart(rec);
      if (v) verifications.push(v);
    } else if (rec.type === "delegation") {
      const d = parseDelegationPart(rec);
      if (d) delegations.push(d);
    }
  }
  return { toolCalls, diffs, plans, verifications, delegations };
}

/** 3.10.2 sub-step 3 — normalize a `delegation` part (Sub-Agent Delegation). */
function parseDelegationPart(
  rec: Record<string, unknown>,
): import("@/components/builder/DelegationTree").DelegationPart | null {
  type Task = import("@/components/builder/DelegationTree").DelegationTask;
  const taskStatuses = ["queued", "running", "done", "failed", "cancelled"];
  const rawTasks = Array.isArray(rec.tasks) ? rec.tasks : [];
  const tasks: Task[] = [];
  rawTasks.forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    const tr = t as Record<string, unknown>;
    const title = typeof tr.title === "string" ? tr.title : "";
    if (!title) return;
    const st =
      typeof tr.status === "string" && taskStatuses.includes(tr.status) ? tr.status : "queued";
    tasks.push({
      id: String(tr.id ?? `dt-${i}`),
      agent: typeof tr.agent === "string" && tr.agent ? tr.agent : "advisor",
      title,
      status: st as Task["status"],
      model: typeof tr.model === "string" ? tr.model : undefined,
      summary: typeof tr.summary === "string" ? tr.summary : undefined,
      tokens: typeof tr.tokens === "number" ? tr.tokens : undefined,
      duration_ms: typeof tr.duration_ms === "number" ? tr.duration_ms : undefined,
    });
  });
  const goal = typeof rec.goal === "string" ? rec.goal : undefined;
  if (tasks.length === 0 && !goal) return null;
  const dStatuses = ["running", "done", "failed", "cancelled"];
  const status =
    typeof rec.status === "string" && dStatuses.includes(rec.status) ? rec.status : "running";
  return {
    delegation_id: typeof rec.delegation_id === "string" ? rec.delegation_id : undefined,
    parent_agent: typeof rec.parent_agent === "string" ? rec.parent_agent : undefined,
    goal,
    status: status as import("@/components/builder/DelegationTree").DelegationStatus,
    tasks,
  };
}

/** 3.10.2 sub-step 2 — normalize a `verification` part (Self-Verify Loop). */
function parseVerificationPart(
  rec: Record<string, unknown>,
): import("@/components/builder/SelfVerifyLoop").VerificationPart | null {
  type Check = import("@/components/builder/SelfVerifyLoop").VerifyCheck;
  const checkStatuses = ["pending", "running", "pass", "fail", "skipped"];
  const kinds = ["logic", "security", "performance", "build", "test"];
  const rawChecks = Array.isArray(rec.checks) ? rec.checks : [];
  const checks: Check[] = [];
  rawChecks.forEach((c, i) => {
    if (!c || typeof c !== "object") return;
    const cr = c as Record<string, unknown>;
    const label = typeof cr.label === "string" ? cr.label : "";
    if (!label) return;
    const st =
      typeof cr.status === "string" && checkStatuses.includes(cr.status) ? cr.status : "pending";
    const kd = typeof cr.kind === "string" && kinds.includes(cr.kind) ? cr.kind : "logic";
    checks.push({
      id: String(cr.id ?? `vc-${i}`),
      label,
      kind: kd as Check["kind"],
      status: st as Check["status"],
      detail: typeof cr.detail === "string" ? cr.detail : undefined,
      duration_ms: typeof cr.duration_ms === "number" ? cr.duration_ms : undefined,
    });
  });
  const target = typeof rec.target === "string" ? rec.target : undefined;
  const verdict = typeof rec.verdict === "string" ? rec.verdict : undefined;
  if (checks.length === 0 && !target && !verdict) return null;
  const vStatuses = ["running", "pass", "fail", "retrying"];
  const status =
    typeof rec.status === "string" && vStatuses.includes(rec.status) ? rec.status : "running";
  const attempt = typeof rec.attempt === "number" && rec.attempt > 0 ? rec.attempt : 1;
  const maxAttempts =
    typeof rec.max_attempts === "number" && rec.max_attempts > 0 ? rec.max_attempts : attempt;
  return {
    verify_id: typeof rec.verify_id === "string" ? rec.verify_id : undefined,
    target,
    agent: typeof rec.agent === "string" ? rec.agent : undefined,
    attempt,
    max_attempts: maxAttempts,
    status: status as import("@/components/builder/SelfVerifyLoop").VerifyStatus,
    verdict,
    fix_summary: typeof rec.fix_summary === "string" ? rec.fix_summary : undefined,
    checks,
  };
}

/** 3.10.2 — normalize a `plan` part (Planning Tree). Returns null when unusable. */
function parsePlanPart(
  rec: Record<string, unknown>,
): import("@/components/builder/PlanningTree").PlanPart | null {
  type Node = import("@/components/builder/PlanningTree").PlanNode;
  const goal = typeof rec.goal === "string" ? rec.goal : "";
  const rawNodes = Array.isArray(rec.nodes) ? rec.nodes : [];
  const statuses = ["pending", "running", "done", "failed", "skipped"];
  const kinds = ["task", "verify", "subagent"];
  const nodes: Node[] = [];
  rawNodes.forEach((n, i) => {
    if (!n || typeof n !== "object") return;
    const nr = n as Record<string, unknown>;
    const title = typeof nr.title === "string" ? nr.title : "";
    if (!title) return;
    const st =
      typeof nr.status === "string" && statuses.includes(nr.status) ? nr.status : "pending";
    const kd = typeof nr.kind === "string" && kinds.includes(nr.kind) ? nr.kind : "task";
    nodes.push({
      id: String(nr.id ?? `pn-${i}`),
      title,
      kind: kd as Node["kind"],
      status: st as Node["status"],
      parent_id: typeof nr.parent_id === "string" ? nr.parent_id : undefined,
      detail: typeof nr.detail === "string" ? nr.detail : undefined,
      agent: typeof nr.agent === "string" ? nr.agent : undefined,
      tool: typeof nr.tool === "string" ? nr.tool : undefined,
      cost_usd: typeof nr.cost_usd === "number" ? nr.cost_usd : undefined,
      duration_ms: typeof nr.duration_ms === "number" ? nr.duration_ms : undefined,
    });
  });
  if (!goal && nodes.length === 0) return null;
  const planStatuses = ["planning", "running", "done", "failed"];
  const ps =
    typeof rec.status === "string" && planStatuses.includes(rec.status) ? rec.status : "running";
  return {
    plan_id: typeof rec.plan_id === "string" ? rec.plan_id : undefined,
    goal,
    status: ps as import("@/components/builder/PlanningTree").PlanStatus,
    nodes,
  };
}

/**
 * Sanitize raw model output before showing in chat.
 * - Strips `<think>...</think>` reasoning blocks (Qwen/DeepSeek).
 * - If output is JSON with `final_answer`, extract that.
 * - Removes stray ``` fences around plain text.
 */
export function cleanAgentText(raw: string): string {
  let text = (raw ?? "").trim();
  if (!text) return "";
  // SSE lifecycle envelopes are transport control messages, never chat copy.
  if (text.startsWith("{")) {
    try {
      const control = JSON.parse(text) as Record<string, unknown>;
      if (
        (control.type === "done" || control.type === "ack") &&
        !control.final_answer &&
        !control.text &&
        !control.content
      ) {
        return "";
      }
    } catch {
      /* not JSON */
    }
  }
  // JSON wrapper from router workers: {"agent":"jimmy","final_answer":"...","candidates":[...]}
  if (text.startsWith("{") && text.includes("final_answer")) {
    try {
      const obj = JSON.parse(text);
      if (typeof obj.final_answer === "string") text = obj.final_answer;
    } catch {
      /* ignore */
    }
  }
  // Strip <think>…</think> (DOTALL)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Strip leaked plain-text reasoning preambles ("Okay, let's see…", "First, I need to…", "The user…").
  // If the head looks like meta-reasoning, drop everything up to the first blank line.
  const reasoningHead =
    /^(okay[,. ]|alright[,. ]|let me\b|let's see|first[,. ]|the user\b|i need to\b|i should\b|hmm[,. ]|so[,. ]|wait[,. ])/i;
  if (reasoningHead.test(text)) {
    const split = text.split(/\n\s*\n/);
    if (split.length > 1) text = split.slice(1).join("\n\n").trim();
  }
  // Strip a leading lone ```lang fence
  text = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return text;
}

/** Slugs the Unified Build Chat surface accepts (everything else is filtered out). */
/** Registered AIs that can be selected explicitly in the founder chat. */
export const UNIFIED_CHAT_SLUGS: ReadonlySet<AgentSlug> = new Set<AgentSlug>([
  "jimmy",
  "sherlock",
  "aria",
  "orion",
  "rex",
  "lyra",
  "sage",
  "atlas",
  "vega",
  "kai",
]);
