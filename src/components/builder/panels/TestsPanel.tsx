/**
 * Phase 10.6 — AI Test Generator panel.
 * Test file list (generated + manual) · pass/fail badges · coverage progress ring ·
 * red→green timeline of Sherlock runs · re-run single or all.
 */
import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Loader2, Play, RefreshCw, Sparkles } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  fetchTestSuite,
  generateTests,
  runTests,
  statusTone,
  type TestFile,
  type TestRunPoint,
  type TestSuiteState,
} from "@/lib/tests-api";

function CoverageRing({ value }: { value: number }) {
  const size = 66;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#E50914";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ filter: `drop-shadow(0 0 6px ${tone})`, transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="absolute font-mono text-[13px] font-semibold" style={{ color: tone }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function Timeline({ runs }: { runs: TestRunPoint[] }) {
  if (runs.length === 0)
    return (
      <p className="px-1 py-1 text-[10.5px] text-muted-foreground">
        Sherlock ne abhi koi run nahi kiya.
      </p>
    );
  return (
    <div className="flex items-end gap-1 px-1 pb-1">
      {runs.map((r, i) => {
        const total = Math.max(1, r.passed + r.failed);
        const greenPct = (r.passed / total) * 100;
        return (
          <div
            key={`${r.at}_${i}`}
            title={`${new Date(r.at).toLocaleString()} · ${r.passed} pass / ${r.failed} fail · ${r.actor}`}
            className="flex h-10 w-3 flex-col justify-end overflow-hidden rounded-sm bg-[#E50914]/70"
          >
            <div
              className="w-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
              style={{ height: `${greenPct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function TestsPanel() {
  const { project } = useBuilder();
  const [state, setState] = useState<TestSuiteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [genPath, setGenPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setState(await fetchTestSuite(project));
    setLoading(false);
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  const doRun = useCallback(
    async (file?: string) => {
      setRunning(file ?? "__all__");
      setError(null);
      const res = await runTests(project, file);
      setRunning(null);
      if (!res?.ok) {
        setError(res?.error ?? "Run fail — /rpc/tests.run pending ya runner busy.");
        return;
      }
      setState((s) => ({
        files: res.files,
        coverage: res.coverage,
        runs: [...(s?.runs ?? []), {
          at: new Date().toISOString(),
          passed: res.files.reduce((n, f) => n + f.passed, 0),
          failed: res.files.reduce((n, f) => n + f.failed, 0),
          actor: "founder" as const,
        }].slice(-24),
      }));
    },
    [project],
  );

  const doGenerate = useCallback(async () => {
    const path = genPath.trim();
    if (!path) return;
    setRunning("__gen__");
    setError(null);
    const res = await generateTests(project, path);
    setRunning(null);
    if (!res?.ok) {
      setError(res?.error ?? "Generate fail — /rpc/tests.generate pending.");
      return;
    }
    setGenPath("");
    await load();
  }, [genPath, load, project]);

  const files: TestFile[] = state?.files ?? [];
  const generated = files.filter((f) => f.origin === "generated");
  const manual = files.filter((f) => f.origin === "manual");

  return (
    <div>
      <PanelSection
        title="Coverage"
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Refresh tests"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        }
      >
        <div className="flex items-center gap-3 px-1 py-1">
          <CoverageRing value={state?.coverage ?? 0} />
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] text-foreground/90">
              {files.length} test files · {files.reduce((n, f) => n + f.total, 0)} cases
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">
              {files.reduce((n, f) => n + f.passed, 0)} pass ·{" "}
              {files.reduce((n, f) => n + f.failed, 0)} fail
            </div>
            <button
              type="button"
              onClick={() => void doRun()}
              disabled={running !== null}
              className="mt-2 inline-flex items-center gap-1.5 rounded border border-[#E50914]/30 bg-[#E50914]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/15 disabled:opacity-50"
            >
              {running === "__all__" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              re-run all
            </button>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Red → green timeline">
        <Timeline runs={state?.runs ?? []} />
      </PanelSection>

      <PanelSection title="Generate">
        <div className="flex items-center gap-1.5">
          <input
            value={genPath}
            onChange={(e) => setGenPath(e.target.value)}
            placeholder="src/components/Button.tsx"
            className="min-w-0 flex-1 rounded border border-white/[0.08] bg-black/40 px-2 py-1 font-mono text-[10.5px] text-foreground/90 outline-none focus:border-[#E50914]/40"
          />
          <button
            type="button"
            onClick={() => void doGenerate()}
            disabled={running !== null || !genPath.trim()}
            className="inline-flex items-center gap-1 rounded border border-white/12 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/85 hover:bg-white/[0.08] disabled:opacity-50"
          >
            {running === "__gen__" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            gen
          </button>
        </div>
        {error && <p className="mt-2 text-[10.5px] text-[#ff7480]">{error}</p>}
      </PanelSection>

      {loading ? (
        <div className="grid h-16 place-items-center text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </span>
        </div>
      ) : (
        <>
          <FileList title={`Auto-generated · ${generated.length}`} files={generated} running={running} onRun={doRun} />
          <FileList title={`Manual · ${manual.length}`} files={manual} running={running} onRun={doRun} />
        </>
      )}
    </div>
  );
}

function FileList({
  title,
  files,
  running,
  onRun,
}: {
  title: string;
  files: TestFile[];
  running: string | null;
  onRun: (file?: string) => void | Promise<void>;
}) {
  return (
    <PanelSection title={title}>
      {files.length === 0 ? (
        <p className="flex items-center gap-1.5 px-1 py-1 text-[10.5px] text-muted-foreground">
          <FlaskConical className="h-3 w-3" /> koi file nahi
        </p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => {
            const tone = statusTone(running === f.path ? "running" : f.status);
            return (
              <li key={f.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.04]">
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-foreground/85">
                  {f.path}
                </span>
                <span className="shrink-0 text-[9.5px] text-muted-foreground/70">
                  {f.passed}/{f.total}
                </span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${tone.className}`}
                >
                  {tone.label}
                </span>
                <button
                  type="button"
                  onClick={() => void onRun(f.path)}
                  disabled={running !== null}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-white/[0.08] hover:text-foreground disabled:opacity-40"
                  aria-label={`Re-run ${f.path}`}
                >
                  {running === f.path ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PanelSection>
  );
}
