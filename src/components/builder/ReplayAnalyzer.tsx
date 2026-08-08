/**
 * Phase 10.2 — Sherlock Replay Analyzer.
 * Root cause card · suggested fix snippet · Apply fix (creates a diff for
 * founder approval, never writes code from the browser) · confidence score.
 */
import { useState } from "react";
import { Loader2, ShieldCheck, Wand2, Check } from "lucide-react";
import { analyzeSession, applyReplayFix, type ReplayAnalysis } from "@/lib/replay-api";

export default function ReplayAnalyzer({
  projectId,
  sessionId,
}: {
  projectId: string;
  sessionId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<ReplayAnalysis | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const run = async () => {
    setBusy(true);
    setNotice(null);
    const res = await analyzeSession(projectId, sessionId);
    setBusy(false);
    if (!res) {
      setNotice("Sherlock analyzer endpoint pending (/rpc/replay.analyze).");
      return;
    }
    setAnalysis(res);
    setApplied(false);
  };

  const apply = async () => {
    if (!analysis) return;
    setBusy(true);
    const res = await applyReplayFix(projectId, sessionId, analysis.id);
    setBusy(false);
    if (res?.ok) {
      setApplied(true);
      setNotice(
        res.diff_id ? `Diff ${res.diff_id.slice(0, 8)} review ke liye ready.` : "Diff created.",
      );
    } else {
      setNotice(res?.error ?? "Apply fix endpoint pending (/rpc/replay.applyfix).");
    }
  };

  const conf = analysis?.confidence ?? 0;

  return (
    <div className="rounded-lg border border-[#8b5cf6]/25 bg-[#8b5cf6]/[0.04] p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c4b5fd]">
          <ShieldCheck className="h-3.5 w-3.5" /> Sherlock analyzer
        </span>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-2 py-1 text-[10px] uppercase tracking-wider text-[#ddd6fe] hover:bg-[#8b5cf6]/20 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          Analyze
        </button>
      </div>

      {analysis ? (
        <div className="space-y-2">
          <div className="rounded-md border border-white/[0.06] bg-black/30 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Root cause
            </p>
            <p className="text-[11px] leading-relaxed text-foreground/90">{analysis.rootCause}</p>
            {analysis.summary && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                {analysis.summary}
              </p>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground/70">
              <span>Confidence</span>
              <span className="font-mono text-[#c4b5fd]">{conf}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#8b5cf6] shadow-[0_0_10px_rgba(139,92,246,0.6)]"
                style={{ width: `${Math.max(0, Math.min(100, conf))}%` }}
              />
            </div>
          </div>

          {analysis.suggestedFix && (
            <div className="rounded-md border border-white/[0.06] bg-black/40 p-2">
              <p className="mb-1 font-mono text-[10px] text-muted-foreground">
                {analysis.suggestedFix.path}
              </p>
              <pre className="fb-no-scrollbar max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-foreground/85">
                {analysis.suggestedFix.snippet}
              </pre>
            </div>
          )}

          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy || applied || !analysis.suggestedFix}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#E50914]/35 bg-[#E50914]/12 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#ff9aa2] hover:bg-[#E50914]/20 disabled:opacity-50"
          >
            {applied ? <Check className="h-3 w-3" /> : <Wand2 className="h-3 w-3" />}
            {applied ? "Diff created" : "Apply fix (create diff)"}
          </button>
        </div>
      ) : (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Sherlock is replay ko parh ke root cause, fix snippet aur confidence score dega.
        </p>
      )}

      {notice && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {notice}
        </p>
      )}
    </div>
  );
}
