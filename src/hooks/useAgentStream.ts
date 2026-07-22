/**
 * Phase 3.10.1 — useAgentStream
 * Real-time subscription to Supabase 3 `agent_thread_messages` for a single
 * thread, PLUS a client-side abort() that POSTs /rpc/tools.abort for any
 * currently-running tool_call in the thread.
 *
 * NO DUPLICATE — this hook wraps `subscribeThread` / `fetchThreadMessages`
 * from `src/lib/agent-stream.ts` (already exists). It does NOT re-implement
 * the Realtime channel.
 *
 * NO DUMMY — if Supabase 3 isn't configured OR the server hasn't emitted
 * any tool_call parts, `activeTools` stays empty. Nothing fake ever renders.
 *
 * Server contract (Rust axonetis-builder runtime):
 *   POST /rpc/tools.abort { tool_call_id, abort_token? } → SIGTERMs the
 *   worker child bound to that tool call and updates status="error" +
 *   error="aborted by founder" on the row.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  extractStructured,
  fetchThreadMessages,
  subscribeThread,
  type AgentMessageRow,
} from "@/lib/agent-stream";
import type { ToolCallPart } from "@/components/builder/ToolCallBubble";

const HOSTFLOW_API_BASE = import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined;

export interface UseAgentStreamResult {
  messages: AgentMessageRow[];
  /** Tool calls currently in `queued` or `running` status across the thread. */
  activeTools: ToolCallPart[];
  /** Total accumulated cost_usd across all messages in this thread. */
  cost: number;
  /** Realtime connection status for the UI to reflect. */
  connected: boolean;
  error: string | null;
  /** Abort a specific tool call → POST /rpc/tools.abort */
  abort: (toolCallId: string, abortToken?: string) => Promise<void>;
  /** Abort ALL currently active tool calls (Cancel-everything). */
  abortAll: () => Promise<void>;
}

export function useAgentStream(threadId: string | null | undefined): UseAgentStreamResult {
  const [messages, setMessages] = useState<AgentMessageRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Historic load + live subscription, scoped to threadId.
  useEffect(() => {
    if (!threadId) { setMessages([]); setConnected(false); return; }
    let unsub: (() => void) | null = null;
    setConnected(false);
    setError(null);

    (async () => {
      try {
        const history = await fetchThreadMessages(threadId);
        if (!mounted.current) return;
        setMessages(history);
        unsub = subscribeThread(threadId, {
          onMessage: (row) => {
            if (!mounted.current) return;
            setMessages((prev) => {
              // Idempotent insert: replace if id already present, else append.
              const idx = prev.findIndex((r) => r.id === row.id);
              if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = row;
                return copy;
              }
              return [...prev, row];
            });
          },
          onError: (e) => {
            if (!mounted.current) return;
            setError(e instanceof Error ? e.message : String(e));
          },
        });
        if (mounted.current) setConnected(true);
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      setConnected(false);
      if (unsub) unsub();
    };
  }, [threadId]);

  // Derive active tools + total cost from message parts.
  const { activeTools, cost } = useMemo(() => {
    const active: ToolCallPart[] = [];
    let total = 0;
    for (const row of messages) {
      if (typeof row.cost_usd === "number") total += row.cost_usd;
      const { toolCalls } = extractStructured(row);
      for (const tc of toolCalls) {
        if (tc.status === "queued" || tc.status === "running") active.push(tc);
      }
    }
    return { activeTools: active, cost: total };
  }, [messages]);

  const abort = useCallback(async (toolCallId: string, abortToken?: string) => {
    if (!HOSTFLOW_API_BASE) throw new Error("VITE_HOSTFLOW_SERVER_URL not configured");
    const res = await fetch(`${HOSTFLOW_API_BASE.replace(/\/$/, "")}/rpc/tools.abort`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_call_id: toolCallId, abort_token: abortToken }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`tools.abort failed (${res.status}): ${text.slice(0, 200)}`);
    }
  }, []);

  const abortAll = useCallback(async () => {
    await Promise.allSettled(activeTools.map((t) => abort(t.id, t.abort_token)));
  }, [abort, activeTools]);

  return { messages, activeTools, cost, connected, error, abort, abortAll };
}
