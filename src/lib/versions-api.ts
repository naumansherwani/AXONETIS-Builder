/**
 * Phase 6 — Version Control client.
 * Talks to Hetzner bridge /api/versions/* with Supabase 3 read-fallback.
 */
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

const BRIDGE = import.meta.env.VITE_HOSTFLOW_BRIDGE_URL ?? "";

export type Snapshot = {
  id: string;
  path: string;
  change: "create" | "update" | "delete";
  author: string | null;
  message: string | null;
  created_at: string;
  env: "sandbox" | "production";
  branch: string;
};

export type Deployment = {
  id: string;
  project_id: string;
  label: string | null;
  summary: string | null;
  status: "pending" | "building" | "live" | "failed" | "rolled_back";
  files_changed: number;
  started_at: string;
  finished_at: string | null;
  current: boolean;
  target_env: "sandbox" | "production";
};

export type RollbackEntry = {
  id: string;
  scope: "file" | "deployment" | "project";
  target_id: string;
  reason: string | null;
  triggered_by: string | null;
  succeeded: boolean;
  notes: string | null;
  created_at: string;
};

async function bridge<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!BRIDGE) return null;
  try {
    const r = await fetch(`${BRIDGE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchSnapshots(projectId: string, limit = 50): Promise<Snapshot[]> {
  const viaBridge = await bridge<{ snapshots: Snapshot[] }>(
    `/api/versions/snapshots?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
  );
  if (viaBridge?.snapshots) return viaBridge.snapshots;

  if (!SUPABASE3_READY) return [];
  const { data } = await supabase3
    .from("file_versions")
    .select("id, path, change, author, message, created_at, env, branch")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Snapshot[];
}

export async function fetchDeployments(projectId: string): Promise<Deployment[]> {
  const viaBridge = await bridge<{ deployments: Deployment[] }>(
    `/api/versions/deployments?projectId=${encodeURIComponent(projectId)}`,
  );
  if (viaBridge?.deployments) return viaBridge.deployments;

  if (!SUPABASE3_READY) return [];
  const { data } = await supabase3
    .from("deployments")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(100);
  return (data ?? []) as Deployment[];
}

export async function fetchRollbackHistory(projectId: string): Promise<RollbackEntry[]> {
  const viaBridge = await bridge<{ history: RollbackEntry[] }>(
    `/api/versions/rollback-history?projectId=${encodeURIComponent(projectId)}`,
  );
  if (viaBridge?.history) return viaBridge.history;

  if (!SUPABASE3_READY) return [];
  const { data } = await supabase3
    .from("rollback_history")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as RollbackEntry[];
}

export async function rollback(input: {
  projectId: string;
  scope: "file" | "deployment";
  targetId: string;
  reason?: string;
  triggeredBy?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await bridge<{ ok?: boolean; error?: string }>("/api/versions/rollback", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res) return { ok: false, error: "Bridge unreachable" };
  if (res.error) return { ok: false, error: res.error };
  return { ok: true };
}
