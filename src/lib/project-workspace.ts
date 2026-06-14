/**
 * Phase 7 — Multi-Project Builder isolation layer.
 *
 * Every project (HostFlow AI, Rapid Pay, AXONETIS Builder…) gets its own
 * independent workspace: chat history, branch, environment, preview env,
 * Sherlock fix-loop counter. State is keyed by `projectId` and persisted
 * to localStorage so switching projects round-trips cleanly.
 *
 * Backend isolation lives in the Hetzner bridge + Supabase (1/2/3) — this
 * file only owns the *frontend* isolation contract.
 */
import type { Branch, Environment, ProjectId } from "./projects";
import type { PreviewEnv } from "./preview-engine";

export type ChatAgent = "founder" | "jimmy" | "sherlock";

export interface ChatMsg {
  id: string;
  agent: ChatAgent;
  text: string;
  thinking?: boolean;
  /** Sherlock fix-loop iteration if this message is part of an auto-fix pass (1..3). */
  fixIteration?: number;
}

export interface ProjectWorkspace {
  projectId: ProjectId;
  branch: Branch;
  environment: Environment;
  previewEnv: PreviewEnv;
  messages: ChatMsg[];
  /** 0 = idle, 1..3 = active Sherlock auto-fix pass. */
  fixLoopIteration: number;
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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* noop */ }
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
export function supabaseLabelFor(projectId: ProjectId): "Supabase 1" | "Supabase 2" | "Supabase 3" {
  if (projectId === "hostflowai") return "Supabase 1";
  if (projectId === "rapidpay") return "Supabase 2";
  return "Supabase 3";
}
