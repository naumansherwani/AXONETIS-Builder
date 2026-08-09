/**
 * Code panel — LIVE file viewer wired to Supabase 3 `project_files`.
 * File list from fetchProjectFiles(), content from fetchFileContent().
 * Realtime refresh on project_files changes.
 *
 * Phase 3.10.8 — inline LSP diagnostics: wavy squiggles on offending lines,
 * hover cards with the tsc message, one-click Jimmy auto-fix, Problems badge.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileCode,
  FileText,
  Loader2,
  RefreshCw,
  Wand2,
  XCircle,
} from "lucide-react";
import { PanelSection } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  fetchProjectFiles,
  fetchFileContent,
  subscribeProjectFiles,
  formatBytes,
  type ProjectFileRow,
} from "@/lib/files-api";
import { useDiagnostics } from "@/hooks/useDiagnostics";
import { diagnosticsByLine, requestAutoFix, type Diagnostic } from "@/lib/lsp-api";
import { SUPABASE3_READY } from "@/integrations/supabase3/client";
import { toast } from "sonner";

export default function CodePanel() {
  const { project } = useBuilder();
  const [rows, setRows] = useState<ProjectFileRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const diag = useDiagnostics(project);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchProjectFiles(project).then((data) => {
        if (!alive) return;
        setRows(data);
        setListLoading(false);
        if (data.length > 0 && !data.find((r) => r.path === selected)) {
          setSelected(data[0].path);
        }
      });
    setListLoading(true);
    load();
    const unsub = subscribeProjectFiles(project, () => load());
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    if (!selected) {
      setContent(null);
      return;
    }
    let alive = true;
    setContentLoading(true);
    fetchFileContent(project, selected)
      .then((r) => {
        if (alive) setContent(r.content);
      })
      .finally(() => {
        if (alive) setContentLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [project, selected]);

  const currentFile = rows.find((r) => r.path === selected);
  const lines = useMemo(() => (content ?? "").split("\n"), [content]);
  const ext = selected?.split(".").pop() ?? "";
  const Icon = ["md", "txt", "mdx"].includes(ext) ? FileText : FileCode;
  const lineDiags = useMemo(
    () =>
      selected ? diagnosticsByLine(diag.diagnostics, selected) : new Map<number, Diagnostic[]>(),
    [diag.diagnostics, selected],
  );
  const fileErrors = useMemo(() => [...lineDiags.values()].flat(), [lineDiags]);

  async function autoFix(d: Diagnostic) {
    const key = `${d.path}:${d.line}:${d.code}`;
    setFixing(key);
    try {
      await requestAutoFix({ projectId: project, diagnostic: d });
      toast.success("Jimmy ko fix bhej diya", { description: `${d.code} · line ${d.line}` });
    } catch (e) {
      toast.error("Auto-fix failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setFixing(null);
    }
  }

  return (
    <PanelSection
      title={selected ? selected.split("/").pop()! : "Code"}
      action={
        <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/60">
          <ProblemsBadge
            errors={diag.errorCount}
            warnings={diag.warningCount}
            loading={diag.loading}
          />
          <button
            onClick={() => void diag.scan()}
            disabled={diag.scanning}
            title="Re-run TypeScript diagnostics"
            className="flex items-center gap-1 rounded border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-foreground/70 hover:bg-white/[0.05] disabled:opacity-50"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${diag.scanning ? "animate-spin" : ""}`} />
            Scan
          </button>
          <span>
            {currentFile
              ? `${formatBytes(currentFile.size_bytes ?? undefined)} · read-only`
              : "read-only"}
          </span>
        </span>
      }
    >
      {!SUPABASE3_READY ? (
        <Empty
          title="Supabase 3 offline"
          hint="Set VITE_SUPABASE3_URL + VITE_SUPABASE3_ANON_KEY to load files."
        />
      ) : listLoading ? (
        <div className="flex items-center gap-2 px-2 py-6 text-[11px] text-muted-foreground/70">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading files…
        </div>
      ) : rows.length === 0 ? (
        <Empty title="No files yet" hint={`project_files is empty for "${project}".`} />
      ) : (
        <div className="grid grid-cols-[140px_1fr] gap-2">
          <div className="fb-no-scrollbar max-h-[55vh] overflow-y-auto rounded-md border border-white/[0.06] bg-black/40 p-1">
            {rows.slice(0, 200).map((r) => {
              const name = r.path.split("/").pop() ?? r.path;
              const active = r.path === selected;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.path)}
                  className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] truncate ${
                    active
                      ? "bg-[#E50914]/12 text-foreground"
                      : "text-foreground/75 hover:bg-white/[0.04] hover:text-foreground"
                  }`}
                  title={r.path}
                >
                  <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
          <div className="rounded-md border border-white/[0.06] bg-black/50 p-2">
            {contentLoading ? (
              <div className="flex items-center gap-2 px-2 py-6 text-[11px] text-muted-foreground/70">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : content == null ? (
              <div className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">
                No content stored for this file.
              </div>
            ) : (
              <>
                <pre className="fb-no-scrollbar max-h-[55vh] overflow-auto font-mono text-[11px] leading-relaxed">
                  {lines.map((l, i) => {
                    const ds = lineDiags.get(i + 1);
                    const hasError = ds?.some((d) => d.severity === "error");
                    return (
                      <div
                        key={i}
                        className={`group relative flex gap-3 hover:bg-white/[0.03] ${
                          ds ? (hasError ? "bg-red-500/[0.06]" : "bg-amber-400/[0.06]") : ""
                        }`}
                      >
                        <span
                          className={`w-6 select-none text-right ${
                            ds
                              ? hasError
                                ? "text-red-400"
                                : "text-amber-400"
                              : "text-muted-foreground/40"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <code
                          className={`whitespace-pre text-foreground/85 ${
                            ds
                              ? `underline decoration-wavy underline-offset-4 ${
                                  hasError ? "decoration-red-500" : "decoration-amber-400"
                                }`
                              : ""
                          }`}
                        >
                          {l || " "}
                        </code>
                        {ds && (
                          <div className="pointer-events-none absolute left-10 top-full z-30 hidden w-[min(420px,80%)] group-hover:block">
                            <div className="pointer-events-auto rounded-md border border-white/[0.1] bg-[#0b0b0d]/95 p-2 shadow-xl backdrop-blur">
                              {ds.map((d, k) => (
                                <div key={k} className="flex items-start gap-2 py-0.5">
                                  {d.severity === "error" ? (
                                    <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                                  ) : (
                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[10px] text-foreground/85">
                                      {d.message}
                                    </div>
                                    <div className="mt-0.5 font-mono text-[9px] text-muted-foreground/60">
                                      {d.code} · {d.line}:{d.column}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => void autoFix(d)}
                                    disabled={fixing === `${d.path}:${d.line}:${d.code}`}
                                    className="flex shrink-0 items-center gap-1 rounded border border-[#E50914]/40 bg-[#E50914]/10 px-1.5 py-0.5 text-[9px] text-foreground/90 hover:bg-[#E50914]/20 disabled:opacity-50"
                                  >
                                    {fixing === `${d.path}:${d.line}:${d.code}` ? (
                                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                    ) : (
                                      <Wand2 className="h-2.5 w-2.5" />
                                    )}
                                    Fix
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </pre>
                {fileErrors.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
                    {fileErrors.slice(0, 20).map((d, k) => (
                      <button
                        key={k}
                        onClick={() => void autoFix(d)}
                        className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-white/[0.04]"
                      >
                        {d.severity === "error" ? (
                          <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[10px] text-foreground/80">
                          {d.message}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">
                          {d.line}:{d.column}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {diag.error && (
        <div className="mt-2 rounded border border-red-500/25 bg-red-500/[0.06] px-2 py-1 text-[10px] text-red-300">
          {diag.error}
        </div>
      )}
    </PanelSection>
  );
}

function ProblemsBadge({
  errors,
  warnings,
  loading,
}: {
  errors: number;
  warnings: number;
  loading?: boolean;
}) {
  if (loading) {
    return <span className="text-[10px] text-muted-foreground/50">Problems…</span>;
  }
  if (errors === 0 && warnings === 0) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-400/90">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 0 problems
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[10px]">
      {errors > 0 && (
        <span className="flex items-center gap-1 text-red-400">
          <XCircle className="h-2.5 w-2.5" />
          {errors}
        </span>
      )}
      {warnings > 0 && (
        <span className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="h-2.5 w-2.5" />
          {warnings}
        </span>
      )}
    </span>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.01] px-3 py-4 text-center">
      <div className="text-[11px] font-semibold text-foreground/80">{title}</div>
      <div className="mt-1 text-[10px] text-muted-foreground/70">{hint}</div>
    </div>
  );
}
