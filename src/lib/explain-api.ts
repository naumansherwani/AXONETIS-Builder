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
