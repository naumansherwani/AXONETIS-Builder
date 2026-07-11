/**
 * Phase 3.9.1 — ToolCallBubble
 * Renders a single tool invocation from the Rust agent runtime.
 * Server contract: parts entry `{ type: "tool_call", id, name, args, status,
 * output?, cost_usd?, duration_ms?, error? }`.
 * No dummy data — bubble only appears when the server emits a tool_call part.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, CircleDot, CircleCheck, CircleX, Loader2, Wrench } from "lucide-react";

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
}

const STATUS_META: Record<ToolCallStatus, { label: string; ring: string; dot: string; icon: typeof CircleDot }> = {
  queued:  { label: "queued",  ring: "border-white/[0.08]",       dot: "text-muted-foreground/60", icon: CircleDot },
  running: { label: "running", ring: "border-[#E50914]/40",       dot: "text-[#ff7480]",           icon: Loader2 },
  success: { label: "success", ring: "border-emerald-500/30",     dot: "text-emerald-400",         icon: CircleCheck },
  error:   { label: "error",   ring: "border-red-500/40",         dot: "text-red-400",             icon: CircleX },
};

function fmtJson(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export default function ToolCallBubble({ tool }: { tool: ToolCallPart }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[tool.status] ?? STATUS_META.queued;
  const Icon = meta.icon;
  const spinning = tool.status === "running";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16 }}
      className={`mt-2 overflow-hidden rounded-lg border ${meta.ring} bg-white/[0.02] backdrop-blur-sm`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-90" : ""}`} />
        <Wrench className="h-3 w-3 shrink-0 text-muted-foreground/60" />
        <span className="font-mono text-[11px] font-medium text-foreground/85">{tool.name}</span>
        <Icon className={`h-3 w-3 shrink-0 ${meta.dot} ${spinning ? "animate-spin" : ""}`} />
        <span className={`font-mono text-[9px] uppercase tracking-wider ${meta.dot}`}>{meta.label}</span>
        <div className="ml-auto flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">
          {typeof tool.duration_ms === "number" && <span>{tool.duration_ms}ms</span>}
          {typeof tool.cost_usd === "number" && <span>${tool.cost_usd.toFixed(4)}</span>}
        </div>
      </button>

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
