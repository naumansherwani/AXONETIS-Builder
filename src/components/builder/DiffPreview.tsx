/**
 * Phase 3.9.1 — DiffPreview
 * Inline unified-diff card for a single file edit emitted by the Rust runtime.
 * Server contract: parts entry `{ type: "diff", path, old, new, language? }`.
 * Dependency-free line diff (LCS) — no Monaco to keep bundle lean.
 * Approve/Reject buttons post `POST /api/agents/diff/decision` when the
 * server registers a diff_id; without diff_id they're visual-only (no dummy).
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronRight, FileDiff, Maximize2, X } from "lucide-react";
import MonacoDiffModal from "./MonacoDiffModal";

export interface DiffPart {
  /** Optional server-side identifier used to POST the founder decision. */
  diff_id?: string;
  path: string;
  old: string;
  new: string;
  language?: string;
}

type Row = { kind: "same" | "add" | "del"; text: string };

/** Small LCS-based line diff. Good enough for chat-inline previews. */
function computeDiff(oldStr: string, newStr: string): Row[] {
  const a = oldStr.split("\n");
  const b = newStr.split("\n");
  const n = a.length;
  const m = b.length;
  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: Row[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { rows.push({ kind: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ kind: "del", text: a[i] }); i++; }
    else { rows.push({ kind: "add", text: b[j] }); j++; }
  }
  while (i < n) rows.push({ kind: "del", text: a[i++] });
  while (j < m) rows.push({ kind: "add", text: b[j++] });
  return rows;
}

async function postDecision(diffId: string, decision: "approve" | "reject") {
  try {
    await fetch("/api/agents/diff/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ diff_id: diffId, decision }),
    });
  } catch (err) {
    console.warn("[DiffPreview] decision post failed", err);
  }
}

export default function DiffPreview({ diff }: { diff: DiffPart }) {
  const [open, setOpen] = useState(true);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [monacoOpen, setMonacoOpen] = useState(false);
  const rows = useMemo(() => computeDiff(diff.old ?? "", diff.new ?? ""), [diff.old, diff.new]);
  const adds = rows.filter((r) => r.kind === "add").length;
  const dels = rows.filter((r) => r.kind === "del").length;

  const decide = (d: "approve" | "reject") => {
    setDecision(d);
    if (diff.diff_id) void postDecision(diff.diff_id, d);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16 }}
      className="mt-2 overflow-hidden rounded-lg border border-[#7c3aed]/25 bg-white/[0.02] backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground/60" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/60" />}
        <FileDiff className="h-3 w-3 text-[#c4a8ff]" />
        <span className="truncate font-mono text-[11px] font-medium text-foreground/85">{diff.path}</span>
        <span className="ml-auto flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider">
          <span className="text-emerald-400">+{adds}</span>
          <span className="text-red-400">-{dels}</span>
          {diff.language && <span className="text-muted-foreground/50">{diff.language}</span>}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/[0.04] bg-black/25">
          <div className="max-h-72 overflow-auto font-mono text-[10.5px] leading-relaxed">
            {rows.map((r, idx) => {
              const bg = r.kind === "add" ? "bg-emerald-500/[0.08]" : r.kind === "del" ? "bg-red-500/[0.08]" : "";
              const fg = r.kind === "add" ? "text-emerald-200/90" : r.kind === "del" ? "text-red-200/90" : "text-foreground/70";
              const gutter = r.kind === "add" ? "+" : r.kind === "del" ? "-" : " ";
              return (
                <div key={idx} className={`flex gap-2 px-2 py-[1px] ${bg}`}>
                  <span className="w-3 shrink-0 select-none text-muted-foreground/40">{gutter}</span>
                  <span className={`whitespace-pre-wrap break-all ${fg}`}>{r.text || "\u00A0"}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-white/[0.04] px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => decide("approve")}
              disabled={decision !== null}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                decision === "approve"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-white/[0.08] text-foreground/70 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-40"
              }`}
            >
              <Check className="h-3 w-3" /> {decision === "approve" ? "Approved" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => decide("reject")}
              disabled={decision !== null}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                decision === "reject"
                  ? "border-red-500/50 bg-red-500/15 text-red-300"
                  : "border-white/[0.08] text-foreground/70 hover:border-red-500/40 hover:text-red-300 disabled:opacity-40"
              }`}
            >
              <X className="h-3 w-3" /> {decision === "reject" ? "Rejected" : "Reject"}
            </button>
            {!diff.diff_id && (
              <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40">
                Server decision endpoint pending
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
