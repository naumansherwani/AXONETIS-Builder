/**
 * Database panel — LIVE row counts + SQL runner (dry-run by default).
 * Tables via anon Supabase 3 head-count; SQL runner via Hetzner brain.
 */
import { useEffect, useState } from "react";
import { PanelSection, Row } from "./PanelChrome";
import { Database as DbIcon, Table2, Loader2, Play, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { fetchTableCounts, runSql, type TableCount, type SqlResult } from "@/lib/database-api";
import { validateSql, type SqlValidation } from "@/lib/power-tools-api";
import { useBuilder } from "@/lib/builder-state";

const SAMPLE = "SELECT id, name, created_at\nFROM projects\nORDER BY created_at DESC\nLIMIT 10;";

export default function DatabasePanel() {
  const { project } = useBuilder();
  const [core, setCore] = useState<TableCount[]>([]);
  const [mirror, setMirror] = useState<TableCount[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const [sql, setSql] = useState(SAMPLE);
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<SqlValidation | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTableCounts()
      .then(({ core, mirror, live }) => {
        if (!alive) return;
        setCore(core); setMirror(mirror); setLive(live);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const rightFor = (t: TableCount) => (t.rows == null ? "rls" : `${t.rows} rows`);

  const doRun = async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    const r = await runSql(sql, dryRun);
    setResult(r);
    setRunning(false);
  };

  const doValidate = async () => {
    if (!sql.trim() || validating) return;
    setValidating(true);
    const v = await validateSql(sql, project);
    setValidation(v);
    setValidating(false);
  };

  return (
    <div>
      <PanelSection title="Connection">
        <Row
          left={<><DbIcon className="h-3.5 w-3.5 text-[#ff7480]" /><span>Hetzner · Supabase 3</span></>}
          right={
            <span className="flex items-center gap-1.5">
              {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" />}
              {live ? "live" : "offline"}
            </span>
          }
        />
      </PanelSection>

      <PanelSection title="Core Tables" action={<span className="text-[10px] text-muted-foreground/60">{core.length}</span>}>
        <div className="flex flex-col">
          {core.map((t) => (
            <Row
              key={t.name}
              left={<><Table2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-mono">{t.name}</span></>}
              right={rightFor(t)}
              onClick={() => setSql(`SELECT * FROM ${t.name} LIMIT 25;`)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Cross-Product Mirrors" action={<span className="text-[10px] text-muted-foreground/60">{mirror.length}</span>}>
        <div className="flex flex-col">
          {mirror.map((t) => (
            <Row
              key={t.name}
              left={<><Table2 className="h-3.5 w-3.5 text-[#a855f7]" /><span className="font-mono">{t.name}</span></>}
              right={rightFor(t)}
              onClick={() => setSql(`SELECT * FROM ${t.name} LIMIT 25;`)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection
        title="SQL Runner"
        action={
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-3 w-3 accent-[#E50914]"
            />
            dry-run
          </label>
        }
      >
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          rows={5}
          className="w-full resize-y rounded-md border border-white/10 bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-emerald-200/90 outline-none focus:border-[#E50914]/40"
          placeholder="SELECT 1;"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <ShieldAlert className="h-3 w-3 text-amber-400/80" />
            {dryRun ? "EXPLAIN only — no writes" : "LIVE — writes will commit"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={doValidate}
              disabled={validating || !sql.trim()}
              title="Sherlock validates safety before commit"
              className="flex items-center gap-1.5 rounded-md border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#c4a3ff] transition hover:bg-[#7c3aed]/20 disabled:opacity-40"
            >
              {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              Sherlock
            </button>
            <button
              onClick={doRun}
              disabled={running || !sql.trim()}
              className="flex items-center gap-1.5 rounded-md border border-[#E50914]/30 bg-[#E50914]/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#ff7480] transition hover:bg-[#E50914]/20 disabled:opacity-40"
            >
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Run
            </button>
          </div>
        </div>

        {validation && (
          <div className={`mt-2 rounded-md border p-2 ${
            validation.verdict === "safe"  ? "border-emerald-500/30 bg-emerald-500/[0.06]" :
            validation.verdict === "warn"  ? "border-amber-500/30 bg-amber-500/[0.06]" :
                                             "border-red-500/30 bg-red-500/[0.06]"
          }`}>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
              <span className={`flex items-center gap-1.5 font-semibold ${
                validation.verdict === "safe" ? "text-emerald-300" :
                validation.verdict === "warn" ? "text-amber-300" : "text-red-300"
              }`}>
                {validation.verdict === "block" ? <ShieldX className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                Sherlock · {validation.verdict}
              </span>
              <span className="text-muted-foreground/60">
                {validation.affectedTables.length} table{validation.affectedTables.length === 1 ? "" : "s"}
                {validation.estimatedRows != null && ` · ~${validation.estimatedRows} rows`}
              </span>
            </div>
            {validation.issues.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-[11px]">
                {validation.issues.map((i, k) => (
                  <li key={k} className={
                    i.level === "error" ? "text-red-300" :
                    i.level === "warn"  ? "text-amber-300" : "text-muted-foreground"
                  }>· {i.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {result && (
          <div className="mt-2 rounded-md border border-white/[0.06] bg-black/30 p-2">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
              <span className={result.ok ? "text-emerald-400" : "text-[#ff7480]"}>
                {result.ok ? `${result.rowCount} rows` : "error"}
              </span>
              <span className="text-muted-foreground/60">
                {result.durationMs.toFixed(0)}ms · {result.dryRun ? "dry" : "live"}
              </span>
            </div>
            {result.error ? (
              <pre className="whitespace-pre-wrap text-[11px] text-[#ff7480]/90">{result.error}</pre>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10.5px]">
                  <thead>
                    <tr className="text-muted-foreground/60">
                      {result.columns.map((c) => <th key={c} className="px-1.5 py-1">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 25).map((r, i) => (
                      <tr key={i} className="border-t border-white/[0.04]">
                        {result.columns.map((c) => (
                          <td key={c} className="max-w-[160px] truncate px-1.5 py-1 text-foreground/80">
                            {String((r as Record<string, unknown>)[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </PanelSection>
    </div>
  );
}
