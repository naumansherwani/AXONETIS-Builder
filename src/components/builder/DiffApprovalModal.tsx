/**
 * Phase 3.10.3 — Diff Approval Modal (batch review).
 * Side-by-side Monaco diff + per-file approve/reject + bulk actions +
 * Sherlock auto-review badge. Decisions post through src/lib/diff-api.ts.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FileDiff, ShieldCheck, ShieldAlert, ShieldQuestion, X } from "lucide-react";
import MonacoDiffView from "./MonacoDiffView";
import type { DiffPart } from "./DiffPreview";
import { postDiffDecision, postDiffDecisionBatch, type DiffDecision } from "@/lib/diff-api";

function SherlockBadge({ verdict }: { verdict?: DiffPart["sherlock"] }) {
  if (!verdict) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
        <ShieldQuestion className="h-3 w-3" /> unreviewed
      </span>
    );
  }
  const map = {
    pass: {
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
      Icon: ShieldCheck,
      label: "Sherlock pass",
    },
    fail: {
      cls: "border-red-500/40 bg-red-500/10 text-red-300",
      Icon: ShieldAlert,
      label: "Sherlock fail",
    },
    retry: {
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      Icon: ShieldAlert,
      label: "Sherlock retry",
    },
  } as const;
  const { cls, Icon, label } = map[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${cls}`}
    >
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

export default function DiffApprovalModal({
  open,
  onClose,
  diffs,
}: {
  open: boolean;
  onClose: () => void;
  diffs: DiffPart[];
}) {
  const [active, setActive] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, DiffDecision>>({});

  const keyOf = (d: DiffPart, i: number) => d.diff_id ?? `${d.path}-${i}`;
  const current = diffs[Math.min(active, Math.max(diffs.length - 1, 0))];
  const wired = diffs.some((d) => d.diff_id);

  const counts = useMemo(() => {
    const vals = Object.values(decisions);
    return {
      approved: vals.filter((v) => v === "approve").length,
      rejected: vals.filter((v) => v === "reject").length,
    };
  }, [decisions]);

  const decide = (d: DiffPart, i: number, decision: DiffDecision) => {
    setDecisions((p) => ({ ...p, [keyOf(d, i)]: decision }));
    if (d.diff_id) void postDiffDecision(d.diff_id, decision);
  };

  const bulk = (decision: DiffDecision) => {
    const next: Record<string, DiffDecision> = {};
    diffs.forEach((d, i) => (next[keyOf(d, i)] = decision));
    setDecisions(next);
    void postDiffDecisionBatch(
      diffs.map((d) => d.diff_id).filter((x): x is string => Boolean(x)),
      decision,
    );
  };

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[86] grid place-items-center bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 90, damping: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="fb-glass relative flex h-[86vh] w-[min(1320px,96vw)] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#08080c] shadow-[0_30px_120px_-20px_rgba(124,58,237,0.5)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7c3aed] to-transparent" />

            {/* header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FileDiff className="h-3.5 w-3.5 text-[#c4a8ff]" />
                <span className="text-[12px] font-semibold text-foreground/90">Diff review</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {diffs.length} files · {counts.approved} approved · {counts.rejected} rejected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulk("approve")}
                  className="rounded-md border border-emerald-500/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/10"
                >
                  Approve all
                </button>
                <button
                  onClick={() => bulk("reject")}
                  className="rounded-md border border-red-500/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-red-300 hover:bg-red-500/10"
                >
                  Reject all
                </button>
                <button
                  onClick={onClose}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1">
              {/* file list */}
              <div className="w-[300px] shrink-0 overflow-auto border-r border-white/[0.06] bg-black/25">
                {diffs.map((d, i) => {
                  const k = keyOf(d, i);
                  const dec = decisions[k];
                  return (
                    <div
                      key={k}
                      className={`border-b border-white/[0.04] px-2.5 py-2 ${
                        i === active ? "bg-[#7c3aed]/10" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActive(i)}
                        className="block w-full truncate text-left font-mono text-[11px] text-foreground/85"
                        title={d.path}
                      >
                        {d.path}
                      </button>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <SherlockBadge verdict={d.sherlock} />
                        <button
                          type="button"
                          onClick={() => decide(d, i, "approve")}
                          className={`grid h-5 w-5 place-items-center rounded border ${
                            dec === "approve"
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                              : "border-white/[0.08] text-muted-foreground hover:text-emerald-300"
                          }`}
                          aria-label={`Approve ${d.path}`}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => decide(d, i, "reject")}
                          className={`grid h-5 w-5 place-items-center rounded border ${
                            dec === "reject"
                              ? "border-red-500/50 bg-red-500/15 text-red-300"
                              : "border-white/[0.08] text-muted-foreground hover:text-red-300"
                          }`}
                          aria-label={`Reject ${d.path}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!wired && (
                  <p className="px-2.5 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40">
                    Decision endpoint pending
                  </p>
                )}
              </div>

              {/* diff */}
              <div className="min-w-0 flex-1">
                <MonacoDiffView
                  key={keyOf(current, active)}
                  oldValue={current.old ?? ""}
                  newValue={current.new ?? ""}
                  language={current.language}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Batch review bar — shown in chat when Jimmy proposes multiple file diffs.
 * Owns its own modal state so message rows stay stateless.
 */
export function DiffBatchReview({ diffs }: { diffs: DiffPart[] }) {
  const [open, setOpen] = useState(false);
  if (diffs.length < 2) return null;
  const failing = diffs.filter((d) => d.sherlock === "fail").length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/[0.06] px-2.5 py-1.5 text-left transition-colors hover:bg-[#7c3aed]/[0.12]"
      >
        <FileDiff className="h-3.5 w-3.5 text-[#c4a8ff]" />
        <span className="text-[11px] font-medium text-foreground/85">
          Review {diffs.length} file changes
        </span>
        {failing > 0 && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-red-300">
            {failing} Sherlock fail
          </span>
        )}
      </button>
      <DiffApprovalModal open={open} onClose={() => setOpen(false)} diffs={diffs} />
    </>
  );
}
