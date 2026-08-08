/**
 * Phase 3.10.2 LAST PIECE — Jimmy planning loop client.
 * Ek run mein Planning Tree + Delegation + Self-Verify teenon ek hi thread
 * message par bind hote hain; UI Supabase 3 Realtime se update hoti hai.
 *
 * Bridge routes: /rpc/orchestrate.begin | .advance | .finish | .get
 */
const BASE =
  (import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export interface OrchestrateNodeInput {
  title: string;
  kind?: "goal" | "task" | "verify" | "subagent" | "tool";
  agent?: string;
  tool?: string;
  detail?: string;
}
export interface OrchestrateTaskInput {
  title: string;
  agent?: string;
  model?: string;
}
export interface OrchestrateCheckInput {
  key: string;
  label?: string;
}

export interface OrchestrateBeginInput {
  threadId: string;
  projectId?: string;
  goal: string;
  nodes?: OrchestrateNodeInput[];
  tasks?: OrchestrateTaskInput[];
  checks?: OrchestrateCheckInput[];
  max_attempts?: number;
}

export interface OrchestrateHandles {
  message_id: string;
  plan_id: string;
  delegation_id: string | null;
  verify_id: string | null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!BASE) throw new Error("VITE_HOSTFLOW_SERVER_URL not configured");
  const res = await fetch(`${BASE}/rpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export function beginOrchestration(input: OrchestrateBeginInput) {
  return post<OrchestrateHandles>("orchestrate.begin", input);
}

export function advanceOrchestration(input: {
  message_id: string;
  plan?: { node_id: string; status?: string; duration_ms?: number; cost_usd?: number };
  task?: {
    task_id: string;
    status?: string;
    summary?: string;
    model?: string;
    tokens?: number;
    duration_ms?: number;
  };
  check?: { key: string; status?: string; detail?: string };
}) {
  return post<{ ok: true }>("orchestrate.advance", input);
}

export function finishOrchestration(input: {
  message_id: string;
  plan_status?: "done" | "failed";
  delegation_status?: "done" | "failed" | "cancelled";
  verify_status?: "passed" | "failed" | "running";
  verdict?: string;
  fix_summary?: string;
}) {
  return post<{ ok: true }>("orchestrate.finish", input);
}

export async function getOrchestration(messageId: string): Promise<{ parts: unknown[] }> {
  if (!BASE) throw new Error("VITE_HOSTFLOW_SERVER_URL not configured");
  const res = await fetch(
    `${BASE}/rpc/orchestrate.get?message_id=${encodeURIComponent(messageId)}`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`orchestrate.get failed (${res.status})`);
  return (await res.json()) as { parts: unknown[] };
}
