/**
 * Phase 3.10.8 — LSP diagnostics API.
 *
 * Truth flow:
 *   bridge `POST /rpc/lsp.diagnostics`  → runs tsgo --noEmit in the project dir,
 *   upserts rows into Supabase 3 `project_diagnostics`, returns the parsed list.
 *   UI reads Supabase 3 (fast, realtime) and can force a re-scan via the bridge.
 *
 * Auto-fix: `POST /rpc/lsp.autofix` hands the diagnostic to Jimmy on the given
 * thread (real agent turn — no client-side patching).
 */
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";
import type { ProjectId } from "./projects";

const BASE =
  (import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  path: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
}

export interface DiagnosticsSnapshot {
  live: boolean;
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  scannedAt: string | null;
}

const EMPTY: DiagnosticsSnapshot = {
  live: false,
  diagnostics: [],
  errorCount: 0,
  warningCount: 0,
  scannedAt: null,
};

function summarize(rows: Diagnostic[], scannedAt: string | null, live: boolean): DiagnosticsSnapshot {
  return {
    live,
    diagnostics: rows,
    errorCount: rows.filter((d) => d.severity === "error").length,
    warningCount: rows.filter((d) => d.severity === "warning").length,
    scannedAt,
  };
}

/** Read cached diagnostics for a project from Supabase 3. */
export async function fetchDiagnostics(projectId: ProjectId): Promise<DiagnosticsSnapshot> {
  if (!SUPABASE3_READY) return EMPTY;
  const { data, error } = await supabase3
    .from("project_diagnostics")
    .select("path, line, column, severity, code, message, created_at")
    .eq("project_id", projectId)
    .order("path", { ascending: true })
    .limit(500);
  if (error) {
    console.warn("[lsp-api] fetch failed:", error.message);
    return EMPTY;
  }
  const rows = (data ?? []) as Array<Diagnostic & { created_at: string }>;
  const scannedAt = rows.reduce<string | null>(
    (acc, r) => (!acc || r.created_at > acc ? r.created_at : acc),
    null,
  );
  return summarize(
    rows.map(({ path, line, column, severity, code, message }) => ({
      path,
      line,
      column,
      severity,
      code,
      message,
    })),
    scannedAt,
    true,
  );
}

/** Force a fresh tsgo scan on the bridge. */
export async function runDiagnosticsScan(
  projectId: ProjectId,
  path?: string,
): Promise<DiagnosticsSnapshot> {
  if (!BASE) throw new Error("VITE_HOSTFLOW_SERVER_URL not configured");
  const res = await fetch(`${BASE}/rpc/lsp.diagnostics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, path }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`lsp.diagnostics failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const j = (await res.json()) as { diagnostics?: Diagnostic[]; scanned_at?: string };
  return summarize(Array.isArray(j.diagnostics) ? j.diagnostics : [], j.scanned_at ?? null, true);
}

/** Ask Jimmy to fix one diagnostic. Returns the thread the fix runs on. */
export async function requestAutoFix(input: {
  projectId: ProjectId;
  threadId?: string;
  diagnostic: Diagnostic;
}): Promise<{ thread_id: string; message_id?: string }> {
  if (!BASE) throw new Error("VITE_HOSTFLOW_SERVER_URL not configured");
  const res = await fetch(`${BASE}/rpc/lsp.autofix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      threadId: input.threadId,
      diagnostic: input.diagnostic,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`lsp.autofix failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as { thread_id: string; message_id?: string };
}

/** Realtime subscription on project_diagnostics. Returns unsubscribe. */
export function subscribeDiagnostics(projectId: ProjectId, onChange: () => void): () => void {
  if (!SUPABASE3_READY) return () => {};
  const channel = supabase3
    .channel(`project_diagnostics:${projectId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "project_diagnostics",
        filter: `project_id=eq.${projectId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase3.removeChannel(channel);
  };
}

/** Group diagnostics by 1-based line for a single file. */
export function diagnosticsByLine(
  diagnostics: Diagnostic[],
  filePath: string,
): Map<number, Diagnostic[]> {
  const norm = (p: string) => p.replace(/^\.?\//, "");
  const target = norm(filePath);
  const map = new Map<number, Diagnostic[]>();
  for (const d of diagnostics) {
    if (!norm(d.path).endsWith(target)) continue;
    const list = map.get(d.line) ?? [];
    list.push(d);
    map.set(d.line, list);
  }
  return map;
}
