/**
 * Phase 10.11 — Auto-Migration Runner client.
 *
 * Bridge endpoints (server-snippets/migration.routes.ts):
 *   GET  /rpc/migration.schema?projectId              → { tables: [{name, columns[]}] }
 *   POST /rpc/migration.dryrun  { projectId, sql }     → MigrationDryRun
 *   POST /rpc/migration.apply   { projectId, sql }     → MigrationApply
 *   POST /rpc/migration.rollback{ projectId }          → { ok, migrationId }
 *   GET  /rpc/migration.history?projectId              → { items }
 */
import { rpc } from "./power-tools-api";

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string }[];
}

export interface MigrationDryRun {
  ok: boolean;
  verdict: "safe" | "warn" | "block";
  affectedTables: string[];
  affectedRows: number | null;
  issues: { level: "info" | "warn" | "error"; message: string }[];
  before: string; // schema snippet before
  after: string; // schema snippet after
  error?: string;
}

export interface MigrationApply {
  ok: boolean;
  migrationId?: string;
  backupId?: string;
  error?: string;
}

export interface MigrationHistoryItem {
  id: string;
  sql: string;
  applied_at: string;
  status: "applied" | "rolled_back" | "failed";
  affected_rows: number | null;
  backup_id: string | null;
}

export async function fetchSchema(projectId: string): Promise<SchemaTable[]> {
  const res = await rpc<{ tables?: SchemaTable[] }>(
    `/rpc/migration.schema?projectId=${encodeURIComponent(projectId)}`,
  );
  return Array.isArray(res?.tables) ? res!.tables! : [];
}

export async function dryRunMigration(
  projectId: string,
  sql: string,
): Promise<MigrationDryRun | null> {
  return rpc<MigrationDryRun>(`/rpc/migration.dryrun`, {
    method: "POST",
    body: JSON.stringify({ projectId, sql }),
  });
}

export async function applyMigration(
  projectId: string,
  sql: string,
): Promise<MigrationApply | null> {
  return rpc<MigrationApply>(`/rpc/migration.apply`, {
    method: "POST",
    body: JSON.stringify({ projectId, sql }),
  });
}

export async function rollbackMigration(
  projectId: string,
): Promise<{ ok: boolean; migrationId?: string; error?: string } | null> {
  return rpc(`/rpc/migration.rollback`, {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
}

export async function fetchMigrationHistory(projectId: string): Promise<MigrationHistoryItem[]> {
  const res = await rpc<{ items?: MigrationHistoryItem[] }>(
    `/rpc/migration.history?projectId=${encodeURIComponent(projectId)}`,
  );
  return Array.isArray(res?.items) ? res!.items! : [];
}

/** Flat completion list for Monaco: table names + qualified columns + SQL keywords. */
export function schemaCompletions(tables: SchemaTable[]): string[] {
  const out = new Set<string>([
    "select",
    "insert into",
    "update",
    "delete from",
    "alter table",
    "create table if not exists",
    "add column if not exists",
    "create index if not exists",
    "create policy",
    "enable row level security",
    "grant select",
  ]);
  for (const t of tables) {
    out.add(t.name);
    for (const c of t.columns) out.add(`${t.name}.${c.name}`);
  }
  return [...out];
}
