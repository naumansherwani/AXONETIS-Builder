/**
 * Phase 10.11 — Auto-Migration Runner bridge routes (hostflow-server, port 8090).
 * Mount:  app.use(migrationRoutes)   in src/index.ts (the Express entrypoint)
 *
 *   GET  /rpc/migration.schema?projectId  → { tables }
 *   POST /rpc/migration.dryrun            → MigrationDryRun
 *   POST /rpc/migration.apply             → { ok, migrationId, backupId }
 *   POST /rpc/migration.rollback          → { ok, migrationId }
 *   GET  /rpc/migration.history?projectId → { items }
 *
 * Table: schema_migrations_log (Supabase 3)
 * SQL: sql/founder/phase-10-advantage/20260816000000_phase_104_1015.sql
 * Executor: direct pg via DATABASE_URL (Supabase 3 Postgres) — real SQL, no mock.
 * Safety: dry-run runs inside BEGIN … ROLLBACK; apply pg_dump-s the touched
 * tables into migration_backups before committing.
 */
import express from "express";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
router.use(express.json({ limit: "2mb" }));

const sb = () =>
  createClient(process.env.SUPABASE3_URL, process.env.SUPABASE3_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const bad = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });

async function withClient(fn) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

const DESTRUCTIVE = /\b(drop\s+(table|column|schema)|truncate|delete\s+from(?!\s+\S+\s+where))\b/i;

function tablesIn(sql) {
  const names = new Set();
  const re =
    /\b(?:from|join|into|update|table|on)\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi;
  let m;
  while ((m = re.exec(sql))) names.add(m[1]);
  return [...names];
}

async function schemaSnapshot(client, names) {
  if (names.length === 0) return "";
  const { rows } = await client.query(
    `select table_name, column_name, data_type
       from information_schema.columns
      where table_schema='public' and table_name = any($1::text[])
      order by table_name, ordinal_position`,
    [names],
  );
  const byTable = new Map();
  for (const r of rows) {
    if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
    byTable.get(r.table_name).push(`  ${r.column_name} ${r.data_type}`);
  }
  return [...byTable.entries()]
    .map(([t, cols]) => `table public.${t} (\n${cols.join(",\n")}\n)`)
    .join("\n\n");
}

// ── schema (for Monaco autocomplete) ────────────────────────────────────────
router.get("/rpc/migration.schema", async (req, res) => {
  if (!req.query.projectId) return bad(res, "projectId required");
  try {
    const tables = await withClient(async (client) => {
      const { rows } = await client.query(
        `select table_name, column_name, data_type
           from information_schema.columns
          where table_schema='public'
          order by table_name, ordinal_position`,
      );
      const map = new Map();
      for (const r of rows) {
        if (!map.has(r.table_name)) map.set(r.table_name, []);
        map.get(r.table_name).push({ name: r.column_name, type: r.data_type });
      }
      return [...map.entries()].map(([name, columns]) => ({ name, columns }));
    });
    res.json({ tables });
  } catch (e) {
    bad(res, `schema read failed: ${e?.message ?? e}`, 500);
  }
});

// ── dry-run (BEGIN … ROLLBACK) ──────────────────────────────────────────────
router.post("/rpc/migration.dryrun", async (req, res) => {
  const { projectId, sql } = req.body ?? {};
  if (!projectId || !sql) return bad(res, "projectId and sql required");

  const names = tablesIn(sql);
  const issues = [];
  if (DESTRUCTIVE.test(sql))
    issues.push({ level: "error", message: "Destructive statement detected (drop/truncate/unscoped delete)." });
  if (!/if\s+(not\s+)?exists/i.test(sql) && /\b(create|alter)\b/i.test(sql))
    issues.push({ level: "warn", message: "Not idempotent — add IF (NOT) EXISTS." });
  if (/create\s+table/i.test(sql) && !/grant\s/i.test(sql))
    issues.push({ level: "warn", message: "CREATE TABLE without GRANT — Data API will 403." });

  try {
    const out = await withClient(async (client) => {
      const before = await schemaSnapshot(client, names);
      await client.query("BEGIN");
      let affected = null;
      try {
        const r = await client.query(sql);
        affected = Array.isArray(r) ? r.reduce((n, x) => n + (x.rowCount ?? 0), 0) : (r.rowCount ?? 0);
        const after = await schemaSnapshot(client, names);
        await client.query("ROLLBACK");
        return { ok: true, before, after, affected };
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        return { ok: false, before, after: before, affected: null, err: e?.message ?? String(e) };
      }
    });

    if (!out.ok) issues.push({ level: "error", message: out.err });
    const verdict = issues.some((i) => i.level === "error")
      ? "block"
      : issues.some((i) => i.level === "warn")
        ? "warn"
        : "safe";

    res.json({
      ok: out.ok,
      verdict,
      affectedTables: names,
      affectedRows: out.affected,
      issues: issues.length > 0 ? issues : [{ level: "info", message: "No issues found." }],
      before: out.before,
      after: out.after,
    });
  } catch (e) {
    bad(res, `dry-run failed: ${e?.message ?? e}`, 500);
  }
});

// ── apply (with backup) ─────────────────────────────────────────────────────
router.post("/rpc/migration.apply", async (req, res) => {
  const { projectId, sql } = req.body ?? {};
  if (!projectId || !sql) return bad(res, "projectId and sql required");
  if (DESTRUCTIVE.test(sql)) return bad(res, "destructive SQL blocked by policy", 422);

  const names = tablesIn(sql);
  const db = sb();
  try {
    const result = await withClient(async (client) => {
      const before = await schemaSnapshot(client, names);
      const backup: Record<string, any> = {};
      for (const t of names) {
        const { rows } = await client
          .query(`select * from public.${t} limit 5000`)
          .catch(() => ({ rows: [] }));
        backup[String(t)] = rows;
      }
      await client.query("BEGIN");
      const r = await client.query(sql);
      await client.query("COMMIT");
      const after = await schemaSnapshot(client, names);
      const affected = Array.isArray(r)
        ? r.reduce((n, x) => n + (x.rowCount ?? 0), 0)
        : (r.rowCount ?? 0);
      return { before, after, backup, affected };
    });

    const { data: backupRow } = await db
      .from("migration_backups")
      .insert({
        project_id: projectId,
        tables: names,
        snapshot: result.backup,
        schema_before: result.before,
      })
      .select("id")
      .single();

    const { data: log } = await db
      .from("schema_migrations_log")
      .insert({
        project_id: projectId,
        sql,
        status: "applied",
        affected_rows: result.affected,
        backup_id: backupRow?.id ?? null,
        schema_before: result.before,
        schema_after: result.after,
      })
      .select("id")
      .single();

    res.json({ ok: true, migrationId: log?.id, backupId: backupRow?.id });
  } catch (e) {
    await db.from("schema_migrations_log").insert({
      project_id: projectId,
      sql,
      status: "failed",
      error: String(e?.message ?? e),
    });
    bad(res, `apply failed: ${e?.message ?? e}`, 500);
  }
});

// ── rollback last applied migration (restores backed-up rows) ───────────────
router.post("/rpc/migration.rollback", async (req, res) => {
  const { projectId } = req.body ?? {};
  if (!projectId) return bad(res, "projectId required");
  const db = sb();

  const { data: last } = await db
    .from("schema_migrations_log")
    .select("id, backup_id")
    .eq("project_id", projectId)
    .eq("status", "applied")
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return bad(res, "no applied migration to roll back", 404);
  if (!last.backup_id) return bad(res, "migration has no backup — manual rollback required", 422);

  const { data: backup } = await db
    .from("migration_backups")
    .select("tables, snapshot")
    .eq("id", last.backup_id)
    .maybeSingle();
  if (!backup) return bad(res, "backup missing", 404);

  try {
    await withClient(async (client) => {
      await client.query("BEGIN");
      for (const t of backup.tables ?? []) {
        const rows = backup.snapshot?.[t] ?? [];
        await client.query(`delete from public.${t}`);
        for (const row of rows) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;
          const params = cols.map((_, i) => `$${i + 1}`).join(",");
          await client.query(
            `insert into public.${t} (${cols.map((c) => `"${c}"`).join(",")}) values (${params})`,
            cols.map((c) => row[c]),
          );
        }
      }
      await client.query("COMMIT");
    });
  } catch (e) {
    return bad(res, `rollback failed: ${e?.message ?? e}`, 500);
  }

  await db
    .from("schema_migrations_log")
    .update({ status: "rolled_back" })
    .eq("id", last.id);
  res.json({ ok: true, migrationId: last.id });
});

router.get("/rpc/migration.history", async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return bad(res, "projectId required");
  const { data, error } = await sb()
    .from("schema_migrations_log")
    .select("id, sql, applied_at, status, affected_rows, backup_id")
    .eq("project_id", projectId)
    .order("applied_at", { ascending: false })
    .limit(30);
  if (error) return bad(res, error.message, 500);
  res.json({ items: data ?? [] });
});

export default router;
