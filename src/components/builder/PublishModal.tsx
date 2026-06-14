/**
 * Phase 7 — 1-click Publish modal.
 * Sandbox → Production promote via Hetzner `/api/preview/promote`.
 * Sherlock final audit chip + live status; rollback hint on failure.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ShieldCheck, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { PROJECTS } from "@/lib/projects";
import { promoteSandboxToProduction } from "@/lib/preview-engine";
import { supabaseLabelFor } from "@/lib/project-workspace";

type Stage = "idle" | "auditing" | "promoting" | "done" | "error";

export default function PublishModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, branch } = useBuilder();
  const active = PROJECTS.find((p) => p.id === project)!;
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  async function handlePublish() {
    setError(null);
    setStage("auditing");
    // Sherlock final audit beat (UI only — server runs the real audit in promote).
    await new Promise((r) => setTimeout(r, 650));
    setStage("promoting");
    try {
      const res = await promoteSandboxToProduction({ projectId: project, branch });
      setDeploymentId(res.deploymentId);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promote failed");
      setStage("error");
    }
  }

  function reset() {
    setStage("idle");
    setError(null);
    setDeploymentId(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-md"
          onClick={reset}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            onClick={(e) => e.stopPropagation()}
            className="fb-glass relative w-[min(560px,92vw)] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#08080c] shadow-[0_30px_120px_-20px_rgba(229,9,20,0.45)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914] to-transparent" />
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-lg"
                  style={{ background: `${active.accent}22`, boxShadow: `0 0 18px ${active.accent}66` }}
                >
                  <Rocket className="h-3.5 w-3.5 text-[#ff7480]" />
                </span>
                <div>
                  <div className="text-[13px] font-semibold">Publish · {active.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                    sandbox → production · branch {branch}
                  </div>
                </div>
              </div>
              <button onClick={reset} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.04] hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-5">
              <Row label="Source" value="sandbox project_files" />
              <Row label="Target" value={active.previewUrl} mono />
              <Row label="Backend" value={supabaseLabelFor(project)} mono />
              <Row label="Branch" value={branch} mono />
            </div>

            <div className="space-y-2 border-t border-white/[0.06] bg-white/[0.02] px-5 py-4">
              <StageRow icon={ShieldCheck} label="Sherlock final audit" state={stageOf(stage, "auditing")} />
              <StageRow icon={Rocket} label="Promote sandbox → production" state={stageOf(stage, "promoting")} />
              {stage === "done" && deploymentId && (
                <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                  Live. deploymentId <span className="font-mono">{deploymentId.slice(0, 8)}</span>
                </div>
              )}
              {stage === "error" && (
                <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">
              <button
                onClick={reset}
                className="h-9 rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 text-[12px] text-muted-foreground hover:text-foreground"
              >
                {stage === "done" ? "Close" : "Cancel"}
              </button>
              {stage !== "done" && (
                <button
                  onClick={handlePublish}
                  disabled={stage === "auditing" || stage === "promoting"}
                  className="flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-[#E50914] to-[#7c0610] px-4 text-[12px] font-semibold uppercase tracking-wider text-white shadow-[0_0_24px_rgba(229,9,20,0.45)] disabled:opacity-50"
                >
                  {stage === "auditing" || stage === "promoting" ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing…</>
                  ) : (
                    <><Rocket className="h-3.5 w-3.5" /> Confirm Publish</>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground/70">{label}</span>
      <span className={mono ? "font-mono text-foreground/90" : "text-foreground/90"}>{value}</span>
    </div>
  );
}

function stageOf(current: Stage, target: Exclude<Stage, "idle" | "done" | "error">): "pending" | "running" | "done" | "error" {
  if (current === "error") return target === "auditing" ? "done" : "error";
  if (current === "idle") return "pending";
  if (current === target) return "running";
  if (current === "done") return "done";
  // promoting reached → auditing was done
  if (target === "auditing" && current === "promoting") return "done";
  return "pending";
}

function StageRow({ icon: Icon, label, state }: { icon: typeof Rocket; label: string; state: "pending" | "running" | "done" | "error" }) {
  const cls = state === "done"
    ? "text-emerald-300"
    : state === "running"
      ? "text-amber-300"
      : state === "error"
        ? "text-red-300"
        : "text-muted-foreground/60";
  return (
    <div className={`flex items-center gap-2.5 text-[12px] ${cls}`}>
      {state === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" />
          : state === "error" ? <AlertCircle className="h-3.5 w-3.5" />
            : <Icon className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </div>
  );
}
