/**
 * Phase 7 — Multi-Project Builder isolation layer.
 *
 * Every project (NEXATECT Global, ANEXOMAIL, ANEXVOT AI PAY, AXONETIS Builder…) gets its own
 * independent workspace: chat history, branch, environment, preview env,
 * Sherlock fix-loop counter. State is keyed by `projectId` and persisted
 * to localStorage so switching projects round-trips cleanly.
 *
 * Backend isolation lives in the Hetzner bridge + Supabase (1/2/3) — this
 * file only owns the *frontend* isolation contract.
 */
import type { Branch, Environment, ProjectId } from "./projects";
import type { PreviewEnv } from "./preview-engine";
import type { ToolCallPart } from "@/components/builder/ToolCallBubble";
import type { DiffPart } from "@/components/builder/DiffPreview";
import type { PlanPart } from "@/components/builder/PlanningTree";
import type { VerificationPart } from "@/components/builder/SelfVerifyLoop";
import type { DelegationPart } from "@/components/builder/DelegationTree";

export type ChatAgent = "founder" | "jimmy" | "sherlock";

export interface ChatMsgMeta {
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  createdAt?: string;
  /** 3.9.7 — Global Router cost meter. */
  costUsd?: number;
  savedVsDefaultUsd?: number;
  defaultModel?: string | null;
}

export interface ChatMsg {
  id: string;
  agent: ChatAgent;
  text: string;
  thinking?: boolean;
  /** Sherlock fix-loop iteration if this message is part of an auto-fix pass (1..3). */
  fixIteration?: number;
  /** 3.9.1 — routing/telemetry chips shown on assistant bubbles. */
  meta?: ChatMsgMeta;
  /** 3.9.1 — original user prompt for /retry on assistant messages. */
  sourcePrompt?: string;
  /** 3.9.1 — tool invocations emitted by the Rust agent runtime. */
  toolCalls?: ToolCallPart[];
  /** 3.9.1 — file diffs proposed by Jimmy for founder approval. */
  diffs?: DiffPart[];
  /** 3.10.2 — Jimmy planning tree (Goal → Tasks → Verification). */
  plans?: PlanPart[];
  /** 3.10.2 — Sherlock self-verification loop passes. */
  verifications?: VerificationPart[];
  /** 3.10.2 — Jimmy sub-agent delegation fan-out. */
  delegations?: DelegationPart[];
}

export interface ProjectWorkspace {
  projectId: ProjectId;
  branch: Branch;
  environment: Environment;
  previewEnv: PreviewEnv;
  messages: ChatMsg[];
  /** 0 = idle, 1..3 = active Sherlock auto-fix pass. */
  fixLoopIteration: number;
  /** Phase A.1 — Supabase 3 thread id for Jimmy chat on this project. */
  jimmyThreadId?: string;
  updatedAt: string;
}

const STORAGE_KEY = "axonetis.phase7.workspaces.v1";

function readAll(): Record<string, ProjectWorkspace> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProjectWorkspace>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, ProjectWorkspace>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

export function loadWorkspace(projectId: ProjectId, seed: ChatMsg[]): ProjectWorkspace {
  const all = readAll();
  const existing = all[projectId];
  if (existing) return existing;
  const fresh: ProjectWorkspace = {
    projectId,
    branch: "main",
    environment: "Sandbox",
    previewEnv: "sandbox",
    messages: seed,
    fixLoopIteration: 0,
    jimmyThreadId: undefined,
    updatedAt: new Date().toISOString(),
  };
  all[projectId] = fresh;
  writeAll(all);
  return fresh;
}

export function saveWorkspace(ws: ProjectWorkspace) {
  const all = readAll();
  all[ws.projectId] = { ...ws, updatedAt: new Date().toISOString() };
  writeAll(all);
}

export function patchWorkspace(projectId: ProjectId, patch: Partial<ProjectWorkspace>) {
  const all = readAll();
  const current = all[projectId];
  if (!current) return;
  all[projectId] = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
}

export function clearWorkspace(projectId: ProjectId) {
  const all = readAll();
  delete all[projectId];
  writeAll(all);
}

/** Supabase instance routed per project (display-only — server enforces). */
export function supabaseLabelFor(projectId: ProjectId): "Core 1" | "Core 2" | "Core 3" | "Mail Core" {
  if (projectId === "anexomail") return "Mail Core";
  if (projectId === "hostflowai") return "Core 1";
  if (projectId === "rapidpay") return "Core 2";
  return "Core 3";
}
