/**
 * Phase 5 — Custom HostFlow Preview Engine (frontend bindings).
 *
 * Replaces Docker sandboxes. Lovable-style flow:
 *   AI → code change → Supabase 3 (project_files) → Realtime → iframe refresh
 *
 * Hard rules:
 *  - Preview NEVER edits production directly.
 *  - All AI changes go to Sandbox first (env="sandbox").
 *  - Founder must promote sandbox → production explicitly.
 *  - Execution stays on hostflow-server. This file only owns the frontend
 *    session contract + Realtime subscription helper.
 */
import { supabase3 } from "@/integrations/supabase3/client";
import { callHostFlowServer } from "./hostflow-api";
import type { ProjectId } from "./projects";

export type PreviewEnv = "sandbox" | "production";

export interface PreviewSession {
  id: string;
  project_id: ProjectId;
  env: PreviewEnv;
  branch: string;
  preview_url: string;
  status: "starting" | "ready" | "stale" | "error";
  created_at: string;
  updated_at: string;
}

export interface PreviewFileChange {
  id: string;
  project_id: ProjectId;
  env: PreviewEnv;
  path: string;
  change: "create" | "update" | "delete";
  changed_at: string;
}

// ── HTTP: session lifecycle on hostflow-server ──────────────────────────────

export function createPreviewSession(input: {
  projectId: ProjectId;
  env: PreviewEnv;
  branch?: string;
}) {
  return callHostFlowServer<PreviewSession>("/api/preview/session", {
    method: "POST",
    body: JSON.stringify({
      projectId: input.projectId,
      env: input.env,
      branch: input.branch ?? "main",
    }),
  });
}

export function getPreviewSession(projectId: ProjectId, env: PreviewEnv) {
  return callHostFlowServer<PreviewSession | null>(
    `/api/preview/session?projectId=${projectId}&env=${env}`,
  );
}

export function promoteSandboxToProduction(input: { projectId: ProjectId; branch?: string }) {
  return callHostFlowServer<{ promoted: boolean; deploymentId: string }>("/api/preview/promote", {
    method: "POST",
    body: JSON.stringify({ projectId: input.projectId, branch: input.branch ?? "main" }),
  });
}

// ── Realtime HMR: subscribe to project_files changes (sandbox only) ─────────

export function subscribePreviewChanges(
  projectId: ProjectId,
  env: PreviewEnv,
  onChange: (change: PreviewFileChange) => void,
) {
  const channel = supabase3
    .channel(`preview:${projectId}:${env}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "project_files",
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (!row || row.env !== env) return;
        onChange({
          id: String(row.id ?? crypto.randomUUID()),
          project_id: projectId,
          env,
          path: String(row.path ?? ""),
          change:
            payload.eventType === "INSERT"
              ? "create"
              : payload.eventType === "DELETE"
                ? "delete"
                : "update",
          changed_at: new Date().toISOString(),
        });
      },
    )
    .subscribe();

  return () => {
    void supabase3.removeChannel(channel);
  };
}
