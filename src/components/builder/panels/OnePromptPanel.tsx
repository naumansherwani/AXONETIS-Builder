/**
 * Phase 10.10 — One-Prompt Full-Stack panel.
 * Prompt → Hermes generates ~20 tasks → 5 parallel workers → deploy countdown → live URL.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Rocket, Sparkles, XCircle } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  beginFullStack,
  cancelFullStack,
  emptyWorkers,
  formatEta,
  openFullStackStream,
  type BuildDeploy,
  type BuildTask,
  type WorkerState,
} from "@/lib/fullstack-api";

const STATE_TONE: Record<BuildTask["state"], string> = {
  queued: "text-muted-foreground",
  running: "text-sky-300",
  done: "text-emerald-300",
  failed: "text-[#ff7480]",
};

export default function OnePromptPanel() {
  const { project } = useBuilder();
  const [prompt, setPrompt] = useState("");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [workers, setWorkers] = useState<WorkerState[]>(emptyWorkers());
  const [deploy, setDeploy] = useState<BuildDeploy>({
    etaSeconds: null,
    url: null,
    phase: "planning",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => () => closeRef.current?.(), []);

  // local countdown ticker between server deploy events
  useEffect(() => {
    if (deploy.etaSeconds === null || deploy.phase === "live" || deploy.phase === "cancelled")
      return;
    const t = window.setInterval(() => {
      setDeploy((d) =>
        d.etaSeconds === null ? d : { ...d, etaSeconds: Math.max(0, d.etaSeconds - 1) },
      );
    }, 1000);
    return () => window.clearInterval(t);
  }, [deploy.etaSeconds, deploy.phase]);

  const start = useCallback(async () => {
    const p = prompt.trim();
    if (!p) return;
    setBusy(true);
    setError(null);
    const res = await beginFullStack(project, p);
    setBusy(false);
    if (!res?.buildId) {
      setError("Begin fail — /rpc/fullstack.begin pending ya Hermes offline.");
      return;
    }
    setBuildId(res.buildId);
    setTasks(res.tasks ?? []);
    setWorkers(emptyWorkers());
    setDeploy({ etaSeconds: null, url: null, phase: "building" });
    closeRef.current = openFullStackStream(project, res.buildId, {
      onTask: (t) =>
        setTasks((list) => {
          const next = list.filter((x) => x.id !== t.id);
          return [...next, t].sort((a, b) => a.index - b.index);
        }),
      onWorker: (w) => setWorkers((list) => list.map((x) => (x.id === w.id ? w : x))),
      onDeploy: setDeploy,
      onDone: () => setBuildId(null),
    });
  }, [project, prompt]);

  const cancel = useCallback(async () => {
    if (!buildId) return;
    await cancelFullStack(project, buildId);
    closeRef.current?.();
    closeRef.current = null;
    setBuildId(null);
    setDeploy((d) => ({ ...d, phase: "cancelled" }));
  }, [buildId, project]);

  const done = tasks.filter((t) => t.state === "done").length;

  return (
    <div>
      <PanelSection title="One prompt → full stack">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Build Airbnb clone"
          className="w-full resize-none rounded border border-white/[0.08] bg-black/40 px-2 py-1.5 text-[11.5px] leading-relaxed text-foreground/90 outline-none focus:border-[#E50914]/40"
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          {buildId ? (
            <button
              type="button"
              onClick={() => void cancel()}
              className="inline-flex items-center gap-1.5 rounded border border-[#E50914]/40 bg-[#E50914]/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/25"
            >
              <XCircle className="h-3 w-3" /> cancel build
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              disabled={busy || !prompt.trim()}
              className="inline-flex items-center gap-1.5 rounded border border-[#E50914]/30 bg-[#E50914]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#ff7480] hover:bg-[#E50914]/15 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              build it
            </button>
          )}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {deploy.phase}
          </span>
        </div>
        {error && <p className="mt-1.5 text-[10.5px] text-[#ff7480]">{error}</p>}
      </PanelSection>

      <PanelSection title="Deploy">
        <div className="flex items-center gap-3 px-1 py-1">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#E50914]/25 bg-[#E50914]/[0.07] shadow-[0_0_24px_-10px_rgba(229,9,20,0.7)]">
            <Rocket className="h-4 w-4 text-[#ff7480]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[16px] font-semibold tabular-nums text-foreground/95">
              {formatEta(deploy.etaSeconds)}
            </div>
            {deploy.url ? (
              <a
                href={deploy.url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 truncate text-[10.5px] text-[#22d3ee] hover:underline"
              >
                {deploy.url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <div className="mt-0.5 text-[10.5px] text-muted-foreground">URL pending…</div>
            )}
          </div>
        </div>
      </PanelSection>

      <PanelSection title={`Workers · ${workers.filter((w) => w.busy).length}/5 busy`}>
        <ul className="space-y-1.5">
          {workers.map((w) => (
            <li key={w.id}>
              <div className="mb-0.5 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">W{w.id}</span>
                <span className="max-w-[200px] truncate text-[10px] text-foreground/75">
                  {w.task ?? "idle"}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    w.busy ? "bg-gradient-to-r from-[#E50914] to-[#ff7480]" : "bg-white/20"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, w.progress))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection title={`Tasks · ${done}/${tasks.length}`}>
        {tasks.length === 0 ? (
          <p className="px-1 py-1 text-[10.5px] text-muted-foreground">
            Prompt do — Hermes 20 tasks generate karega.
          </p>
        ) : (
          <ol className="space-y-0.5">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2 px-1 py-0.5">
                <span className="w-4 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground/70">
                  {t.index}
                </span>
                <span
                  className={`min-w-0 flex-1 text-[10.5px] leading-relaxed ${STATE_TONE[t.state]}`}
                >
                  {t.title}
                </span>
                {t.worker && (
                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">
                    W{t.worker}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </PanelSection>
    </div>
  );
}
