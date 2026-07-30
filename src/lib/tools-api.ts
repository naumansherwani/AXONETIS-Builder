/**
 * Tools API — Tool Registry preview (mirrors phase 3.10 registry).
 * Endpoint: GET /api/agents/founder/tools
 * Read-only summary — full registry CRUD lives in Phase 3.10.
 */
const BASE =
  (import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export interface ToolEntry {
  name: string;
  category: "code" | "search" | "db" | "http" | "shell" | "ai" | "system";
  description: string;
  agents: string[]; // which agents can call it
  enabled: boolean;
  invocations24h: number;
}

export interface ToolsSnapshot {
  live: boolean;
  tools: ToolEntry[];
  fetchedAt: string;
}

export async function fetchTools(): Promise<ToolsSnapshot> {
  const fetchedAt = new Date().toISOString();
  if (!BASE) return { live: false, tools: [], fetchedAt };
  try {
    const res = await fetch(`${BASE}/api/agents/founder/tools`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { live: false, tools: [], fetchedAt };
    const j = await res.json();
    return { live: true, tools: Array.isArray(j.tools) ? j.tools : [], fetchedAt };
  } catch {
    return { live: false, tools: [], fetchedAt };
  }
}

/**
 * Phase 3.10.1 — POST /rpc/tools.abort
 * Fired from the ToolCallBubble cancel button. Server SIGTERMs the Rust
 * worker child bound to this tool_call and marks the row aborted. UI
 * updates via Supabase 3 Realtime.
 */
export async function abortToolCall(toolCallId: string, abortToken?: string): Promise<void> {
  if (!BASE) throw new Error("VITE_HOSTFLOW_SERVER_URL not configured");
  const res = await fetch(`${BASE}/rpc/tools.abort`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_call_id: toolCallId, abort_token: abortToken }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`tools.abort failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
