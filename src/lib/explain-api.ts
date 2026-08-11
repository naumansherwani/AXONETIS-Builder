/**
 * Phase 10.14 — Explainability Layer client.
 * "Why did the AI do that?" — model, memory entries, tools, decision chain.
 *
 * Bridge endpoint (server-snippets/explain.routes.ts):
 *   GET /rpc/explain.get?projectId&messageId → Explanation
 */
import { rpc } from "./power-tools-api";

export interface MemoryRef {
  id: string;
  title: string;
  snippet: string;
  score: number | null;
}

export interface ToolRef {
  id: string;
  name: string;
  status: "ok" | "error" | "running";
  at: string;
  duration_ms: number | null;
}

export interface DecisionStep {
  id: string;
  index: number;
  label: string;
  kind: "plan" | "route" | "tool" | "verify" | "answer";
  detail: string | null;
}

export interface Explanation {
  messageId: string;
  why: string;
  model: string | null;
  modelReason: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  memory: MemoryRef[];
  tools: ToolRef[];
  chain: DecisionStep[];
}

export async function fetchExplanation(
  projectId: string,
  messageId: string,
): Promise<Explanation | null> {
  return rpc<Explanation>(
    `/rpc/explain.get?projectId=${encodeURIComponent(projectId)}&messageId=${encodeURIComponent(messageId)}`,
  );
}

export function stepTone(kind: DecisionStep["kind"]): string {
  switch (kind) {
    case "plan":
      return "#E50914";
    case "route":
      return "#60a5fa";
    case "tool":
      return "#fbbf24";
    case "verify":
      return "#a855f7";
    default:
      return "#34d399";
  }
}

/**
 * Explainability WRITE path — POST /rpc/explain.record.
 * Called when a stream finishes so the WHY tooltip and workspace memory
 * counter show real data instead of "bridge pending".
 */
export async function recordExplanation(input: {
  projectId: string;
  messageId: string;
  why: string;
  model?: string | null;
  modelReason?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsd?: number | null;
  chain?: DecisionStep[];
  tools?: ToolRef[];
  memoryTitle?: string;
  memoryContent?: string;
  memoryKind?: "episodic" | "semantic" | "procedural" | "fact";
  memoryImportance?: number;
}): Promise<boolean> {
  const res = await rpc<{ ok: boolean }>(`/rpc/explain.record`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return Boolean(res?.ok);
}

export interface WorkspaceMemoryRow {
  id: string;
  title: string;
  content: string;
  kind: string;
  importance: number | null;
  created_at: string;
}

export async function listWorkspaceMemory(
  projectId: string,
  limit = 50,
): Promise<WorkspaceMemoryRow[]> {
  return (
    (await rpc<WorkspaceMemoryRow[]>(
      `/rpc/memory.list?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
    )) ?? []
  );
}

export async function writeWorkspaceMemory(input: {
  projectId: string;
  title: string;
  content: string;
  kind?: string;
  importance?: number;
  messageId?: string;
}): Promise<boolean> {
  const res = await rpc<{ ok: boolean }>(`/rpc/memory.write`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return Boolean(res?.ok);
}
