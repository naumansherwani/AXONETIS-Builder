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

export type RapidPayAgentSlug =
  | "jimmy" | "sherlock"
  | "ledger-fox" | "recovery-phantom" | "treasury-sentinel" | "corridor-brain"
  | "treasury-navigator" | "runtime-echo" | "replay-keeper" | "settlement-hawk" | "fraud-radar"
  | "treasury-stress-intelligence" | "revenue-brain" | "explainability-civilization"
  | "founder-sandbox-civilization" | "global-router";

export interface AgentRoutingConfig {
  primary: { provider: "openrouter"; models: string[] };
  secondary?: { provider: "groq"; mode: "speed_acceleration"; models?: string[] };
  last_resort?: { provider: "ollama"; models: string[] };
  memory_target_messages?: number;
}

export interface AgentInfo {
  slug: AgentSlug;
  name: string;
  role: string;
  kind: "supreme" | "advisor" | "rapidpay" | "router";
  model_primary: string;
  model_fallback: string[];
  routing_config?: AgentRoutingConfig;
  status: "online" | "thinking" | "idle" | "offline" | "error";
}

export interface RapidPayAgentInfo {
  slug: RapidPayAgentSlug;
  name: string;
  role: string;
  layer: "supreme" | "treasury" | "intelligence" | "router" | "security";
  routing_config: AgentRoutingConfig;
  security_guardian?: boolean;
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
  userMessageId?: string;
  assistantMessageId?: string;
  assistantText?: string;
  warning?: string;
  rustError?: string | null;
  status: "queued" | "streaming" | "done";
}
export async function chatWithAgent(slug: AgentSlug, body: AgentChatRequest) {
  // Phase A.1 (3-process-split-LOCKED Option B): same-origin TanStack proxy
  // → inserts user msg into Supabase 3 → forwards to Rust brain :8088.
  // Forward Supabase 3 access token so the server can attribute the thread
  // to the founder's auth.users.id (agent_threads.user_id is NOT NULL).
  const { supabase3 } = await import("@/integrations/supabase3/client");
  const { data: { session } } = await supabase3.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(`/api/agents/${slug}/chat`, {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`chatWithAgent ${slug} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as AgentChatResponse;
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

// ────────────────────────────────────────────────────────────────────
// Phase 4 — Dual-Brain Workflow (Jimmy plan → code → Sherlock verify)
// Implemented on hostflowai-server: src/routes/dual-brain.routes.ts
// ────────────────────────────────────────────────────────────────────

export type DualBrainStage =
  | "queued"
  | "jimmy_planning"
  | "jimmy_coding"
  | "sherlock_reviewing"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "applied"
  | "failed";

export type DualBrainVerdict = "approve" | "reject" | "needs_changes";

export interface DualBrainStep {
  id: string;
  run_id: string;
  actor: "jimmy" | "sherlock";
  phase: "plan" | "code" | "review" | "verdict" | "fix" | "apply";
  title: string;
  body: string;
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number | null;
  created_at: string;
}

export interface DualBrainRun {
  id: string;
  project_id: ProjectId;
  prompt: string;
  stage: DualBrainStage;
  plan_summary: string | null;
  code_diff: string | null;
  sherlock_verdict: DualBrainVerdict | null;
  sherlock_notes: string | null;
  iteration: number;
  max_iterations: number;
  total_cost_usd: number;
  started_at: string;
  finished_at: string | null;
}

export interface DispatchDualBrainBody {
  projectId: ProjectId;
  prompt: string;
  threadId?: string;
  maxIterations?: number;
}

export function dispatchDualBrain(body: DispatchDualBrainBody) {
  return callHostFlowServer<{ runId: string; status: "queued" }>("/api/dual-brain/dispatch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getDualBrainRun(runId: string) {
  return callHostFlowServer<{ run: DualBrainRun; steps: DualBrainStep[] }>(
    `/api/dual-brain/runs/${runId}`,
  );
}

export function listDualBrainRuns(params: { projectId?: ProjectId; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.projectId) q.set("projectId", params.projectId);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return callHostFlowServer<DualBrainRun[]>(`/api/dual-brain/runs${qs ? `?${qs}` : ""}`);
}

export function decideDualBrainRun(runId: string, decision: "approve" | "reject", note?: string) {
  return callHostFlowServer<{ runId: string; stage: DualBrainStage }>(
    `/api/dual-brain/runs/${runId}/${decision}`,
    { method: "POST", body: JSON.stringify({ note }) },
  );
}

/** Subscribe to a dual-brain run via SSE. Returns close function. */
export function subscribeDualBrainRun(
  runId: string,
  onEvent: (evt: { type: "step" | "stage" | "done"; step?: DualBrainStep; run?: DualBrainRun }) => void,
  onError?: (e: Event) => void,
): () => void {
  if (!HOSTFLOW_API_BASE) {
    console.warn("[hostflow-api] dual-brain SSE skipped — VITE_HOSTFLOW_SERVER_URL missing");
    return () => {};
  }
  const url = `${HOSTFLOW_API_BASE.replace(/\/$/, "")}/api/dual-brain/runs/${runId}/stream`;
  const es = new EventSource(url, { withCredentials: true });
  es.onmessage = (ev) => {
    try { onEvent(JSON.parse(ev.data)); } catch { /* ignore */ }
  };
  if (onError) es.onerror = onError;
  return () => es.close();
}

// ────────────────────────────────────────────────────────────────────
// Rapid Pay — Supabase 2 future endpoints (frontend contract only)
// ────────────────────────────────────────────────────────────────────

export const listRapidPayAgents = () => callHostFlowServer<RapidPayAgentInfo[]>("/api/rapidpay/agents");

export function chatWithRapidPayAgent(slug: RapidPayAgentSlug, body: AgentChatRequest) {
  return callHostFlowServer<AgentChatResponse>(`/api/rapidpay/agents/${slug}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function runRapidPayFraudScan(projectId: ProjectId, target?: string) {
  return callHostFlowServer<{ scanId: string; status: string }>("/api/rapidpay/agents/fraud-radar/scan", {
    method: "POST",
    body: JSON.stringify({ projectId, target }),
  });
}

export function runRapidPayTreasurySentinelScan(projectId: ProjectId, target?: string) {
  return callHostFlowServer<{ scanId: string; status: string }>("/api/rapidpay/agents/treasury-sentinel/scan", {
    method: "POST",
    body: JSON.stringify({ projectId, target }),
  });
}

export function runRapidPaySherlockSecurityScan(projectId: ProjectId, target?: string) {
  return callHostFlowServer<{ scanId: string; status: string }>("/api/rapidpay/security/sherlock/scan", {
    method: "POST",
    body: JSON.stringify({ projectId, target }),
  });
}

export function listRapidPayThreads(params: { projectId?: ProjectId; agentSlug?: RapidPayAgentSlug } = {}) {
  const q = new URLSearchParams();
  if (params.projectId) q.set("projectId", params.projectId);
  if (params.agentSlug) q.set("agentSlug", params.agentSlug);
  const qs = q.toString();
  return callHostFlowServer<AgentThread[]>(`/api/rapidpay/agents/threads${qs ? `?${qs}` : ""}`);
}

export function getRapidPayThreadMessages(threadId: string) {
  return callHostFlowServer<AgentMessage[]>(`/api/rapidpay/agents/threads/${threadId}/messages`);
}

export function getRapidPayAgentMemory(slug: RapidPayAgentSlug, params: { scope?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.scope) q.set("scope", params.scope);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return callHostFlowServer<AgentMemoryRow[]>(`/api/rapidpay/agents/${slug}/memory${qs ? `?${qs}` : ""}`);
}

export function writeRapidPayAgentMemory(slug: RapidPayAgentSlug, body: {
  scope: "episodic" | "semantic" | "procedural" | "fact";
  content: string;
  key?: string;
  importance?: number;
  projectId?: ProjectId;
}) {
  return callHostFlowServer<{ id: string }>(`/api/rapidpay/agents/${slug}/memory`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listRapidPayActivity(params: { projectId?: ProjectId; agentSlug?: RapidPayAgentSlug; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.projectId) q.set("projectId", params.projectId);
  if (params.agentSlug) q.set("agentSlug", params.agentSlug);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return callHostFlowServer<AgentActivity[]>(`/api/rapidpay/agents/activity${qs ? `?${qs}` : ""}`);
}

export function routeRapidPayTask(body: { projectId: ProjectId; task: string; context?: Record<string, unknown> }) {
  return callHostFlowServer<{ agent: RapidPayAgentSlug; reason: string; estimatedCost: number }>(
    "/api/rapidpay/agents/router/route",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function dispatchRapidPaySwarm(body: { projectId: ProjectId; task: string; agents?: RapidPayAgentSlug[]; context?: Record<string, unknown> }) {
  return callHostFlowServer<{ runId: string; status: string }>("/api/rapidpay/swarm/dispatch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
