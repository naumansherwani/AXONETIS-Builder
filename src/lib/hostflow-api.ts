/**
 * Frontend-only client for existing HostFlow server APIs.
 * AXONETIS does not execute AI/backend logic in this repo.
 * All endpoints below are implemented in `hostflowai-server` (Hetzner).
 */
import type { ProjectId } from "./projects";

const HOSTFLOW_API_BASE = import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined;

export interface HostFlowBridgeCommand {
  projectId: ProjectId;
  prompt: string;
  branch: string;
  environment: string;
}

export async function callHostFlowServer<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  if (!HOSTFLOW_API_BASE) {
    throw new Error("HostFlow server URL is not configured (VITE_HOSTFLOW_SERVER_URL).");
  }
  const response = await fetch(`${HOSTFLOW_API_BASE.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(`HostFlow server request failed: ${response.status}`);
  return response.json() as Promise<TResponse>;
}

export function sendBuilderCommand(command: HostFlowBridgeCommand) {
  return callHostFlowServer<{ taskId: string; status: string }>("/api/axon/commands", {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function getBridgeHealth(projectId: ProjectId) {
  return callHostFlowServer<{ status: string; checkedAt: string }>(
    `/api/axon/bridge/health?projectId=${projectId}`,
  );
}

// ────────────────────────────────────────────────────────────────────
// Phase 3 — Agent endpoints (implemented on hostflowai-server)
// ────────────────────────────────────────────────────────────────────

export type AgentSlug =
  | "jimmy" | "sherlock"
  | "aria" | "orion" | "rex" | "lyra" | "sage" | "atlas" | "vega" | "kai"
  | "router";

export interface AgentInfo {
  slug: AgentSlug;
  name: string;
  role: string;
  kind: "supreme" | "advisor" | "rapidpay" | "router";
  model_primary: string;
  model_fallback: string[];
  status: "online" | "thinking" | "idle" | "offline" | "error";
}

export interface AgentThread {
  id: string;
  project_id: ProjectId;
  agent_slug: AgentSlug;
  title: string;
  message_count: number;
  last_message_at: string | null;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  thread_id: string;
  role: "user" | "agent" | "system" | "tool";
  agent_slug: AgentSlug | null;
  parts: Array<{ type: string; text?: string; [k: string]: unknown }>;
  tokens_in: number;
  tokens_out: number;
  model: string | null;
  created_at: string;
}

export interface AgentActivity {
  id: string;
  agent_slug: AgentSlug;
  project_id: ProjectId | null;
  thread_id: string | null;
  kind: "chat" | "build" | "scan" | "fix" | "deploy" | "rollback" | "memory_write" | "route" | "error";
  summary: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  duration_ms: number | null;
  status: "online" | "thinking" | "idle" | "offline" | "error";
  created_at: string;
}

export interface AgentMemoryRow {
  id: string;
  agent_slug: AgentSlug;
  scope: "episodic" | "semantic" | "procedural" | "fact";
  key: string | null;
  content: string;
  importance: number;
  created_at: string;
  accessed_at: string;
}

// Registry
export const listAgents = () => callHostFlowServer<AgentInfo[]>("/api/agents");

// Chat — Jimmy / Sherlock / advisor
export interface AgentChatRequest {
  projectId: ProjectId;
  threadId?: string;
  prompt: string;
}
export interface AgentChatResponse {
  threadId: string;
  messageId: string;
  status: "queued" | "streaming" | "done";
}
export function chatWithAgent(slug: AgentSlug, body: AgentChatRequest) {
  return callHostFlowServer<AgentChatResponse>(`/api/agents/${slug}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Sherlock scan
export function runSherlockScan(projectId: ProjectId, target?: string) {
  return callHostFlowServer<{ scanId: string; status: string }>("/api/agents/sherlock/scan", {
    method: "POST",
    body: JSON.stringify({ projectId, target }),
  });
}

// Threads
export function listThreads(params: { projectId?: ProjectId; agentSlug?: AgentSlug } = {}) {
  const q = new URLSearchParams();
  if (params.projectId) q.set("projectId", params.projectId);
  if (params.agentSlug) q.set("agentSlug", params.agentSlug);
  const qs = q.toString();
  return callHostFlowServer<AgentThread[]>(`/api/agents/threads${qs ? `?${qs}` : ""}`);
}

export function getThreadMessages(threadId: string) {
  return callHostFlowServer<AgentMessage[]>(`/api/agents/threads/${threadId}/messages`);
}

// Memory
export function getAgentMemory(slug: AgentSlug, params: { scope?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.scope) q.set("scope", params.scope);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return callHostFlowServer<AgentMemoryRow[]>(`/api/agents/${slug}/memory${qs ? `?${qs}` : ""}`);
}

export function writeAgentMemory(slug: AgentSlug, body: {
  scope: "episodic" | "semantic" | "procedural" | "fact";
  content: string;
  key?: string;
  importance?: number;
  projectId?: ProjectId;
}) {
  return callHostFlowServer<{ id: string }>(`/api/agents/${slug}/memory`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Activity feed
export function listActivity(params: { projectId?: ProjectId; agentSlug?: AgentSlug; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.projectId) q.set("projectId", params.projectId);
  if (params.agentSlug) q.set("agentSlug", params.agentSlug);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return callHostFlowServer<AgentActivity[]>(`/api/agents/activity${qs ? `?${qs}` : ""}`);
}

/** Subscribe to live activity feed via SSE. Returns close function. */
export function subscribeActivity(
  onEvent: (a: AgentActivity) => void,
  onError?: (e: Event) => void,
): () => void {
  if (!HOSTFLOW_API_BASE) {
    console.warn("[hostflow-api] SSE skipped — VITE_HOSTFLOW_SERVER_URL missing");
    return () => {};
  }
  const url = `${HOSTFLOW_API_BASE.replace(/\/$/, "")}/api/agents/activity/stream`;
  const es = new EventSource(url, { withCredentials: true });
  es.onmessage = (ev) => {
    try { onEvent(JSON.parse(ev.data) as AgentActivity); } catch { /* ignore */ }
  };
  if (onError) es.onerror = onError;
  return () => es.close();
}

// Router
export function routeTask(body: { projectId: ProjectId; task: string; context?: Record<string, unknown> }) {
  return callHostFlowServer<{ agent: AgentSlug; reason: string; estimatedCost: number }>(
    "/api/agents/router/route",
    { method: "POST", body: JSON.stringify(body) },
  );
}
