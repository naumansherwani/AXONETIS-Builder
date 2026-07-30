/**
 * PHASE 4 — Dual-Brain Workflow Panel.
 * Jimmy (plan + code) → Sherlock (review + verdict) → Founder approve/reject.
 * Frontend-only UI; all work runs on hostflowai-server via /api/dual-brain/*.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Brain, ShieldCheck, Sparkles, Check, X, Play, Loader2, AlertTriangle } from "lucide-react";
import { PanelSection, Row, Dot } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  dispatchDualBrain,
  subscribeDualBrainRun,
  getDualBrainRun,
  listDualBrainRuns,
  decideDualBrainRun,
  type DualBrainRun,
  type DualBrainStep,
  type DualBrainStage,
} from "@/lib/hostflow-api";

const STAGE_TONE: Record<DualBrainStage, "gray" | "violet" | "sky" | "amber" | "emerald" | "red"> =
  {
    queued: "gray",
    jimmy_planning: "violet",
    jimmy_coding: "violet",
    sherlock_reviewing: "sky",
    awaiting_approval: "amber",
    approved: "emerald",
    applied: "emerald",
    rejected: "red",
    failed: "red",
  };

const STAGE_LABEL: Record<DualBrainStage, string> = {
  queued: "Queued",
  jimmy_planning: "Jimmy · Planning",
  jimmy_coding: "Jimmy · Coding",
  sherlock_reviewing: "Sherlock · Review",
  awaiting_approval: "Awaiting Founder",
  approved: "Approved",
  applied: "Applied",
  rejected: "Rejected",
  failed: "Failed",
};

export default function DualBrainPanel() {
  const { project } = useBuilder();
  const [prompt, setPrompt] = useState("");
  const [recent, setRecent] = useState<DualBrainRun[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<DualBrainRun | null>(null);
  const [steps, setSteps] = useState<DualBrainStep[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load recent runs
  useEffect(() => {
    let alive = true;
    listDualBrainRuns({ projectId: project, limit: 10 })
      .then((rows) => {
        if (alive) setRecent(rows);
      })
      .catch(() => {
        /* server may be down, keep empty */
      });
    return () => {
      alive = false;
    };
  }, [project]);

  // Live subscribe to active run
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    getDualBrainRun(activeId)
      .then((data) => {
        if (!alive) return;
        setActiveRun(data.run);
        setSteps(data.steps);
      })
      .catch(() => {});
    const close = subscribeDualBrainRun(activeId, (evt) => {
      if (evt.type === "step" && evt.step) {
        setSteps((s) => [...s, evt.step!]);
      } else if (evt.run) {
        setActiveRun(evt.run);
      }
    });
    return () => {
      alive = false;
      close();
    };
  }, [activeId]);

  const dispatch = async () => {
    if (!prompt.trim() || dispatching) return;
    setDispatching(true);
    setError(null);
    try {
      const { runId } = await dispatchDualBrain({ projectId: project, prompt: prompt.trim() });
      setActiveId(runId);
      setSteps([]);
      setActiveRun(null);
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to dispatch");
    } finally {
      setDispatching(false);
    }
  };

  const decide = async (decision: "approve" | "reject") => {
    if (!activeId) return;
    try {
      await decideDualBrainRun(activeId, decision);
      const data = await getDualBrainRun(activeId);
      setActiveRun(data.run);
      setSteps(data.steps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    }
  };

  const tone = activeRun ? STAGE_TONE[activeRun.stage] : "gray";
  const awaiting = activeRun?.stage === "awaiting_approval";
  const running =
    activeRun &&
    ["queued", "jimmy_planning", "jimmy_coding", "sherlock_reviewing"].includes(activeRun.stage);

  return (
    <div>
      <PanelSection title="Dispatch Dual-Brain">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) dispatch();
          }}
          placeholder="Describe what Jimmy should build…  (⌘/Ctrl+Enter to dispatch)"
          rows={3}
          className="w-full resize-none rounded-md border border-white/[0.06] bg-black/40 px-2.5 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-[#E50914]/40 focus:outline-none"
        />
        <button
          onClick={dispatch}
          disabled={!prompt.trim() || dispatching}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-[#E50914] to-[#a4060f] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_0_18px_-6px_#E50914] transition-opacity disabled:opacity-40"
        >
          {dispatching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Dispatch · Jimmy → Sherlock
        </button>
        {error && (
          <div className="mt-2 flex items-start gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10.5px] text-red-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </PanelSection>

      {activeRun && (
        <PanelSection
          title="Active Run"
          action={
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Dot tone={tone} /> {STAGE_LABEL[activeRun.stage]}
              {running && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            </span>
          }
        >
          <div className="space-y-2">
            <p className="rounded border border-white/[0.05] bg-black/30 px-2 py-1.5 text-[11px] text-foreground/85">
              {activeRun.prompt}
            </p>

            <StageTrack stage={activeRun.stage} />

            {steps.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {steps.map((s) => (
                  <StepRow key={s.id} step={s} />
                ))}
              </div>
            )}

            {activeRun.code_diff && (
              <details className="mt-2 rounded border border-white/[0.06] bg-black/40">
                <summary className="cursor-pointer px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-foreground/80">
                  Code Diff · {activeRun.code_diff.split("\n").length} lines
                </summary>
                <pre className="max-h-60 overflow-auto px-2 pb-2 text-[10.5px] leading-relaxed text-foreground/80">
                  {activeRun.code_diff}
                </pre>
              </details>
            )}

            {activeRun.sherlock_notes && (
              <div className="rounded border border-sky-400/20 bg-sky-400/[0.04] px-2 py-1.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300">
                  <ShieldCheck className="h-3 w-3" /> Sherlock ·{" "}
                  {activeRun.sherlock_verdict ?? "review"}
                </div>
                <p className="text-[11px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                  {activeRun.sherlock_notes}
                </p>
              </div>
            )}

            {awaiting && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => decide("approve")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300 hover:bg-emerald-500/30"
                >
                  <Check className="h-3 w-3" /> Approve & Apply
                </button>
                <button
                  onClick={() => decide("reject")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-red-500/20 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300 hover:bg-red-500/30"
                >
                  <X className="h-3 w-3" /> Reject
                </button>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-white/[0.04] pt-1.5 text-[10px] text-muted-foreground">
              <span>
                Iter {activeRun.iteration}/{activeRun.max_iterations}
              </span>
              <span>${activeRun.total_cost_usd.toFixed(4)}</span>
            </div>
          </div>
        </PanelSection>
      )}

      <PanelSection title="Recent Runs">
        {recent.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-muted-foreground/70">
            No runs yet. Dispatch your first dual-brain task above.
          </p>
        ) : (
          recent.map((r) => (
            <Row
              key={r.id}
              onClick={() => setActiveId(r.id)}
              active={activeId === r.id}
              left={
                <>
                  <Dot tone={STAGE_TONE[r.stage]} />
                  <span className="truncate">{r.prompt}</span>
                </>
              }
              right={STAGE_LABEL[r.stage]}
            />
          ))
        )}
      </PanelSection>
    </div>
  );
}

const STAGE_ORDER: DualBrainStage[] = [
  "queued",
  "jimmy_planning",
  "jimmy_coding",
  "sherlock_reviewing",
  "awaiting_approval",
  "applied",
];

function StageTrack({ stage }: { stage: DualBrainStage }) {
  const failed = stage === "failed" || stage === "rejected";
  const currentIdx = useMemo(() => {
    if (stage === "approved") return STAGE_ORDER.indexOf("awaiting_approval");
    const i = STAGE_ORDER.indexOf(stage);
    return i === -1 ? STAGE_ORDER.length - 1 : i;
  }, [stage]);

  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx && !failed;
        return (
          <motion.div
            key={s}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: done || active ? 1 : 0.35 }}
            className={`h-1 flex-1 rounded-full ${
              failed
                ? "bg-red-500/60"
                : active
                  ? "bg-gradient-to-r from-[#E50914] to-[#a855f7] shadow-[0_0_8px_#E50914]"
                  : done
                    ? "bg-emerald-400/70"
                    : "bg-white/[0.06]"
            }`}
          />
        );
      })}
    </div>
  );
}

function StepRow({ step }: { step: DualBrainStep }) {
  const isJimmy = step.actor === "jimmy";
  const Icon = isJimmy ? Sparkles : ShieldCheck;
  return (
    <div
      className={`rounded border px-2 py-1.5 ${isJimmy ? "border-[#E50914]/15 bg-[#E50914]/[0.04]" : "border-sky-400/20 bg-sky-400/[0.04]"}`}
    >
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em]">
        <Icon className={`h-3 w-3 ${isJimmy ? "text-[#ff7480]" : "text-sky-300"}`} />
        <span className={isJimmy ? "text-[#ff7480]" : "text-sky-300"}>{step.actor}</span>
        <span className="text-muted-foreground/60">· {step.phase}</span>
        {step.duration_ms && (
          <span className="ml-auto text-muted-foreground/50">{Math.round(step.duration_ms)}ms</span>
        )}
      </div>
      <div className="text-[11px] font-medium text-foreground/90">{step.title}</div>
      {step.body && (
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-foreground/70 whitespace-pre-wrap">
          {step.body}
        </p>
      )}
    </div>
  );
}
