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
  const { data, error } = await supabase3
    .from("agent_thread_messages")
    .select("id, thread_id, role, agent_slug, parts, tokens_in, tokens_out, model, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);
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
 * Sanitize raw model output before showing in chat.
 * - Strips `<think>...</think>` reasoning blocks (Qwen/DeepSeek).
 * - If output is JSON with `final_answer`, extract that.
 * - Removes stray ``` fences around plain text.
 */
export function cleanAgentText(raw: string): string {
  let text = (raw ?? "").trim();
  if (!text) return "";
  // JSON wrapper from router workers: {"agent":"jimmy","final_answer":"...","candidates":[...]}
  if (text.startsWith("{") && text.includes("final_answer")) {
    try {
      const obj = JSON.parse(text);
      if (typeof obj.final_answer === "string") text = obj.final_answer;
    } catch { /* ignore */ }
  }
  // Strip <think>…</think> (DOTALL)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Strip leaked plain-text reasoning preambles ("Okay, let's see…", "First, I need to…", "The user…").
  // If the head looks like meta-reasoning, drop everything up to the first blank line.
  const reasoningHead = /^(okay[,. ]|alright[,. ]|let me\b|let's see|first[,. ]|the user\b|i need to\b|i should\b|hmm[,. ]|so[,. ]|wait[,. ])/i;
  if (reasoningHead.test(text)) {
    const split = text.split(/\n\s*\n/);
    if (split.length > 1) text = split.slice(1).join("\n\n").trim();
  }
  // Strip a leading lone ```lang fence
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/i, "").trim();
  return text;
}

/** Slugs the Unified Build Chat surface accepts (everything else is filtered out). */
export const UNIFIED_CHAT_SLUGS: ReadonlySet<AgentSlug> = new Set<AgentSlug>(["jimmy", "sherlock"]);
