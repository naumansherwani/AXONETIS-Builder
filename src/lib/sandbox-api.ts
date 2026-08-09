/**
 * Phase 10.13 — Founder Sandbox client.
 * Production / Sandbox environment isolation (project_envs row kind='sandbox').
 *
 * Bridge endpoints (server-snippets/sandbox.routes.ts):
 *   GET  /rpc/sandbox.status?projectId          → SandboxStatus
 *   POST /rpc/sandbox.switch { projectId, kind } → SandboxStatus
 *   POST /rpc/sandbox.reset  { projectId }       → { ok, reset_at }
 */
import { rpc } from "./power-tools-api";

export type EnvKind = "production" | "sandbox";

export interface SandboxStatus {
  kind: EnvKind;
  isolated: boolean;
  created_at: string | null;
  expires_at: string | null;
  rows: number | null;
}

const STORAGE_KEY = "axonetis.env.kind";

export function readLocalEnvKind(): EnvKind {
  if (typeof window === "undefined") return "production";
  return localStorage.getItem(STORAGE_KEY) === "sandbox" ? "sandbox" : "production";
}

export function writeLocalEnvKind(kind: EnvKind): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, kind);
}

export async function fetchSandboxStatus(projectId: string): Promise<SandboxStatus | null> {
  return rpc<SandboxStatus>(`/rpc/sandbox.status?projectId=${encodeURIComponent(projectId)}`);
}

export async function switchEnv(projectId: string, kind: EnvKind): Promise<SandboxStatus | null> {
  return rpc<SandboxStatus>(`/rpc/sandbox.switch`, {
    method: "POST",
    body: JSON.stringify({ projectId, kind }),
  });
}

export async function resetSandbox(
  projectId: string,
): Promise<{ ok: boolean; reset_at?: string; error?: string } | null> {
  return rpc(`/rpc/sandbox.reset`, {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
}

export const RESET_CONFIRM_WORD = "RESET";
