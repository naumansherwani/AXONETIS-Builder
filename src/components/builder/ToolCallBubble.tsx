/**
 * Phase 3.10.1 — ToolCallBubble (EXTENDED)
 * Foundation from Phase 3.9.1. Added in 3.10.1:
 *   • Category-mapped top border (code/search/db/http/shell/ai)
 *   • Animated progress bar (0→100 when `progress` provided, indeterminate shimmer otherwise)
 *   • Cancel button wired to onAbort(tool.id) → /rpc/tools.abort (server SIGTERM)
 *   • abort_token surfaced from Rust runtime (used by caller when present)
 *
 * NO DUPLICATE — this is the single canonical ToolCallBubble.
 * NO DUMMY — bubble only renders when Rust runtime emits a tool_call part.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight, CircleDot, CircleCheck, CircleX, Loader2, Wrench, XSquare,
  Code2, Search, Database, Globe, Terminal, Sparkles,
} from "lucide-react";

export type ToolCallStatus = "queued" | "running" | "success" | "error";

export interface ToolCallPart {
  id: string;
  name: string;
  args?: unknown;
  status: ToolCallStatus;
  output?: unknown;
  cost_usd?: number;
  duration_ms?: number;
  error?: string;
  /** 3.10.1 — 0..100 progress from Rust runtime (optional). */
  progress?: number;
  /** 3.10.1 — server token used to SIGTERM the running tool (optional). */
  abort_token?: string;
}

// ── Category classification (single source of truth) ────────────────
type Category = "code" | "search" | "db" | "http" | "shell" | "ai" | "generic";
interface CategoryMeta {
  border: string;   // top-border color class
  glow: string;     // subtle glow tint
  icon: typeof Wrench;
  label: string;
}
const CATEGORY_META: Record<Category, CategoryMeta> = {
  code:    { border: "border-t-violet-400/70",   glow: "shadow-[0_0_18px_-8px_rgba(139,92,246,0.55)]", icon: Code2,    label: "code"    },
  search:  { border: "border-t-cyan-400/70",     glow: "shadow-[0_0_18px_-8px_rgba(34,211,238,0.55)]", icon: Search,   label: "search"  },
  db:      { border: "border-t-emerald-400/70",  glow: "shadow-[0_0_18px_-8px_rgba(52,211,153,0.55)]", icon: Database, label: "db"      },
  http:    { border: "border-t-amber-400/70",    glow: "shadow-[0_0_18px_-8px_rgba(251,191,36,0.55)]", icon: Globe,    label: "http"    },
  shell:   { border: "border-t-rose-400/70",     glow: "shadow-[0_0_18px_-8px_rgba(251,113,133,0.55)]", icon: Terminal, label: "shell"   },
  ai:      { border: "border-t-fuchsia-400/70",  glow: "shadow-[0_0_18px_-8px_rgba(232,121,249,0.55)]", icon: Sparkles, label: "ai"      },
  generic: { border: "border-t-white/[0.10]",    glow: "",                                              icon: Wrench,   label: "tool"    },
};

function classifyTool(name: string): Category {
  const n = name.toLowerCase();
  if (/(write_file|line_replace|edit|patch|apply_diff|create_file|delete_file|format)/.test(n)) return "code";
  if (/(search|grep|find|list|read_file|view|rg\b)/.test(n)) return "search";
  if (/(sql|db|database|query|migration|supabase)/.test(n)) return "db";
  if (/(fetch|http|curl|request|webhook|api_call)/.test(n)) return "http";
  if (/(shell|bash|exec|run_cmd|terminal|pm2)/.test(n)) return "shell";
  if (/(spawn_subagent|llm|classify|route|generate|embed|sherlock)/.test(n)) return "ai";
  return "generic";
}

const STATUS_META: Record<ToolCallStatus, { label: string; ring: string; dot: string; icon: typeof CircleDot }> = {
  queued:  { label: "queued",  ring: "border-white/[0.08]",   dot: "text-muted-foreground/60", icon: CircleDot },
  running: { label: "running", ring: "border-[#E50914]/40",   dot: "text-[#ff7480]",           icon: Loader2 },
  success: { label: "success", ring: "border-emerald-500/30", dot: "text-emerald-400",         icon: CircleCheck },
  error:   { label: "error",   ring: "border-red-500/40",     dot: "text-red-400",             icon: CircleX },
};

function fmtJson(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export interface ToolCallBubbleProps {
  tool: ToolCallPart;
  /** 3.10.1 — invoked when founder clicks Cancel. Should call POST /rpc/tools.abort. */
  onAbort?: (toolCallId: string, abortToken?: string) => void | Promise<void>;
}

export default function ToolCallBubble({ tool, onAbort }: ToolCallBubbleProps) {
  const [open, setOpen] = useState(false);
  const [aborting, setAborting] = useState(false);
  const statusMeta = STATUS_META[tool.status] ?? STATUS_META.queued;
  const category = classifyTool(tool.name);
  const catMeta = CATEGORY_META[category];
  const StatusIcon = statusMeta.icon;
  const CategoryIcon = catMeta.icon;
  const spinning = tool.status === "running";
  const isRunning = tool.status === "running";
  const hasProgress = typeof tool.progress === "number";
  const pct = hasProgress ? Math.max(0, Math.min(100, tool.progress as number)) : 0;

  async function handleAbort(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onAbort || aborting) return;
    setAborting(true);
    try { await onAbort(tool.id, tool.abort_token); }
    finally { setAborting(false); }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16 }}
      className={`mt-2 overflow-hidden rounded-lg border ${statusMeta.ring} border-t-2 ${catMeta.border} bg-white/[0.02] backdrop-blur-sm ${isRunning ? catMeta.glow : ""}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-90" : ""}`} />
        <CategoryIcon className="h-3 w-3 shrink-0 text-muted-foreground/70" />
        <span className="font-mono text-[11px] font-medium text-foreground/85">{tool.name}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/45">·{catMeta.label}</span>
        <StatusIcon className={`h-3 w-3 shrink-0 ${statusMeta.dot} ${spinning ? "animate-spin" : ""}`} />
        <span className={`font-mono text-[9px] uppercase tracking-wider ${statusMeta.dot}`}>{statusMeta.label}</span>
        <div className="ml-auto flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">
          {typeof tool.duration_ms === "number" && <span>{tool.duration_ms}ms</span>}
          {typeof tool.cost_usd === "number" && <span>${tool.cost_usd.toFixed(4)}</span>}
          {isRunning && onAbort && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleAbort}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleAbort(e as unknown as React.MouseEvent); }}
              className={`flex items-center gap-1 rounded border border-red-500/40 bg-red-950/30 px-1.5 py-0.5 text-red-300 transition-colors hover:bg-red-900/50 ${aborting ? "opacity-50 pointer-events-none" : ""}`}
              title="Cancel this tool call"
            >
              <XSquare className="h-2.5 w-2.5" />
              {aborting ? "aborting…" : "cancel"}
            </span>
          )}
        </div>
      </button>

      {/* 3.10.1 — Progress bar (determinate if progress provided, else indeterminate shimmer) */}
      {isRunning && (
        <div className="relative h-[3px] w-full overflow-hidden bg-white/[0.04]">
          {hasProgress ? (
            <motion.div
              className={`h-full ${catMeta.border.replace("border-t-", "bg-")}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 60, damping: 20 }}
            />
          ) : (
            <div className={`absolute inset-y-0 w-1/3 ${catMeta.border.replace("border-t-", "bg-")} tc-shimmer opacity-80`} />
          )}
        </div>
      )}

      {open && (
        <div className="space-y-2 border-t border-white/[0.04] bg-black/20 px-2.5 py-2">
          {tool.args !== undefined && (
            <div>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">Input</div>
              <pre className="max-h-40 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-foreground/80">
                {fmtJson(tool.args)}
              </pre>
            </div>
          )}
          {tool.output !== undefined && (
            <div>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">Output</div>
              <pre className="max-h-56 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-emerald-200/80">
                {fmtJson(tool.output)}
              </pre>
            </div>
          )}
          {tool.error && (
            <div>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-red-400/70">Error</div>
              <pre className="max-h-40 overflow-auto rounded bg-red-950/30 p-2 font-mono text-[10px] leading-relaxed text-red-200/90">
                {tool.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
