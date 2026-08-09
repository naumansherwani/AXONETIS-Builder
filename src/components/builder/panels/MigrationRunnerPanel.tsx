/**
 * Phase 10.11 — Auto-Migration Runner panel.
 * Monaco SQL editor with schema autocomplete · dry-run (affected rows) ·
 * before/after diff preview · approve/reject · apply with backup · rollback.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Database, History, Loader2, Play, RotateCcw, Undo2, X } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import MonacoDiffView from "../MonacoDiffView";
import { useBuilder } from "@/lib/builder-state";
import {
  applyMigration,
  dryRunMigration,
  fetchMigrationHistory,
  fetchSchema,
  rollbackMigration,
  schemaCompletions,
  type MigrationDryRun,
  type MigrationHistoryItem,
  type SchemaTable,
} from "@/lib/migration-api";

const Editor = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));

const VERDICT_TONE: Record<MigrationDryRun["verdict"], string> = {
  safe: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  block: "border-[#E50914]/40 bg-[#E50914]/10 text-[#ff7480]",
};

export default function MigrationRunnerPanel() {
  const { project } = useBuilder();
  const [sql, setSql] = useState("-- alter table public.projects add column if not exists tagline text;\n");
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [dry, setDry] = useState<MigrationDryRun | null>(null);
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending");
  const [history, setHistory] = useState<MigrationHistoryItem[]>([]);
  const [busy, setBusy] = useState<null | "dry" | "apply" | "rollback">(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, h] = await Promise.all([fetchSchema(project), fetchMigrationHistory(project)]);
    setTables(t);
    setHistory(h);
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  const completions = useMemo(() => schemaCompletions(tables), [tables]);

  const doDryRun = useCallback(async () => {
    setBusy("dry");
    setNote(null);
    setDecision("pending");
    const res = await dryRunMigration(project, sql);
    setBusy(null);
    if (!res) {
      setNote("Dry-run fail — /rpc/migration.dryrun pending.");
      return;
    }
    setDry(res);
  }, [project, sql]);

  const doApply = useCallback(async () => {
    setBusy("apply");
    setNote(null);
    const res = await applyMigration(project, sql);
    setBusy(null);
    if (!res?.ok) {
      setNote(res?.error ?? "Apply fail — /rpc/migration.apply pending.");
      return;
    }
    setNote(`Applied · backup ${res.backupId ?? "n/a"}`);
    setDry(null);
    setDecision("pending");
    await load();
  }, [load, project, sql]);

  const doRollback = useCallback(async () => {
    setBusy("rollback");
    setNote(null);
    const res = await rollbackMigration(project);
    setBusy(null);
    setNote(res?.ok ? `Rolled back ${res.migrationId ?? ""}` : (res?.error ?? "Rollback fail."));
    await load();
  }, [load, project]);

  return (
    <div>
      <PanelSection
        title="SQL"
        action={
          <span className="font-mono text-[9.5px] text-muted-foreground/70">
            {tables.length} tables
          </span>
        }
      >
        <div className="overflow-hidden rounded border border-white/[0.08]">
          <Suspense
            fallback={
              <div className="grid h-40 place-items-center bg-black/50 text-[10.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            }
          >
            <Editor
              height="180px"
              language="sql"
              theme="vs-dark"
              value={sql}
              onChange={(v) => setSql(v ?? "")}
              options={{
                fontSize: 11,
                minimap: { enabled: false },
                lineNumbers: "off",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                padding: { top: 8, bottom: 8 },
              }}
              onMount={(_editor, monaco) => {
                monaco.languages.registerCompletionItemProvider("sql", {
                  provideCompletionItems: (model, position) => {
                    const word = model.getWordUntilPosition(position);
                    const range = {
                      startLineNumber: position.lineNumber,
                      endLineNumber: position.lineNumber,
                      startColumn: word.startColumn,
                      endColumn: word.endColumn,
                    };
                    return {
                      suggestions: completions.map((label) => ({
                        label,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: label,
                        range,
                      })),
                    };
                  },
                });
              }}
            />
          </Suspense>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void doDryRun()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded border border-white/12 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/85 hover:bg-white/[0.08] disabled:opacity-50"
          >
            {busy === "dry" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            dry-run
          </button>
          <button
            type="button"
            onClick={() => void doRollback()}
            disabled={busy !== null || history.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300 hover:bg-amber-400/15 disabled:opacity-40"
          >
            {busy === "rollback" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Undo2 className="h-3 w-3" />
            )}
            rollback
          </button>
        </div>
        {note && <p className="mt-1.5 text-[10.5px] text-foreground/80">{note}</p>}
      </PanelSection>

      {dry && (
        <>
          <PanelSection title="Dry-run">
            <div className="space-y-1.5 px-1 py-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${VERDICT_TONE[dry.verdict]}`}
                >
                  {dry.verdict}
                </span>
                <span className="text-[10.5px] text-muted-foreground">
                  {dry.affectedRows === null ? "rows unknown" : `${dry.affectedRows} rows affected`}
                </span>
              </div>
              {dry.affectedTables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dry.affectedTables.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] text-foreground/80"
                    >
                      <Database className="h-2.5 w-2.5" /> {t}
                    </span>
                  ))}
                </div>
              )}
              {dry.issues.map((i, idx) => (
                <p
                  key={idx}
                  className={`text-[10.5px] leading-relaxed ${
                    i.level === "error"
                      ? "text-[#ff7480]"
                      : i.level === "warn"
                        ? "text-amber-300"
                        : "text-muted-foreground"
                  }`}
                >
                  {i.message}
                </p>
              ))}
            </div>
          </PanelSection>

          <PanelSection title="Before → after">
            <div className="h-[160px] overflow-hidden rounded border border-white/[0.08]">
              <MonacoDiffView original={dry.before} modified={dry.after} language="sql" />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDecision("approved")}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  decision === "approved"
                    ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                    : "border-white/12 bg-white/[0.04] text-foreground/85 hover:bg-white/[0.08]"
                }`}
              >
                <Check className="h-3 w-3" /> approve
              </button>
              <button
                type="button"
                onClick={() => {
                  setDecision("rejected");
                  setDry(null);
                }}
                className="inline-flex items-center gap-1.5 rounded border border-white/12 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/85 hover:bg-white/[0.08]"
              >
                <X className="h-3 w-3" /> reject
              </button>
              <button
                type="button"
                onClick={() => void doApply()}
                disabled={decision !== "approved" || dry.verdict === "block" || busy !== null}
                className="ml-auto inline-flex items-center gap-1.5 rounded border border-[#E50914]/30 bg-[#E50914]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/15 disabled:opacity-40"
              >
                {busy === "apply" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                apply
              </button>
            </div>
          </PanelSection>
        </>
      )}

      <PanelSection
        title="History"
        action={<History className="h-3 w-3 text-muted-foreground/70" />}
      >
        {history.length === 0 ? (
          <p className="px-1 py-1 text-[10.5px] text-muted-foreground">koi migration nahi</p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="rounded-md px-2 py-1.5 hover:bg-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground/85">
                    {h.sql.replace(/\s+/g, " ").slice(0, 60)}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider ${
                      h.status === "applied"
                        ? "text-emerald-300"
                        : h.status === "rolled_back"
                          ? "text-amber-300"
                          : "text-[#ff7480]"
                    }`}
                  >
                    {h.status}
                  </span>
                </div>
                <div className="mt-0.5 text-[9.5px] text-muted-foreground/70">
                  {new Date(h.applied_at).toLocaleString()}
                  {h.affected_rows !== null ? ` · ${h.affected_rows} rows` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}
