/**
 * Phase 3.10.2 (Intelligence Layer) — sub-step 3: Sub-Agent Delegation UI
 *
 * Jimmy bade kaam ko sub-agents (Sherlock + 8 advisors) mein tod kar delegate
 * karta hai. Har delegated task live status ke saath dikhta hai.
 *
 * Server contract — a part on `agent_thread_messages.parts`:
 *
 *   {
 *     type: "delegation",
 *     delegation_id: "uuid",
 *     parent_agent?: "jimmy",
 *     goal?: "Wire publish parity",
 *     status: "running" | "done" | "failed" | "cancelled",
 *     tasks: [
 *       { id, agent: "sherlock" | "<advisor-slug>", title,
 *         status: "queued"|"running"|"done"|"failed"|"cancelled",
 *         model?, summary?, tokens?, duration_ms? }
 *     ]
 *   }
 *
 * Zero dummy: `delegation` part na ho to component render hi nahi hota.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Loader2,
  Network,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

export type DelegationTaskStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type DelegationStatus = "running" | "done" | "failed" | "cancelled";

export interface DelegationTask {
  id: string;
  agent: string;
  title: string;
  status: DelegationTaskStatus;
  model?: string;
  summary?: string;
  tokens?: number;
  duration_ms?: number;
}

export interface DelegationPart {
  delegation_id?: string;
  parent_agent?: string;
  goal?: string;
  status: DelegationStatus;
  tasks: DelegationTask[];
}

/** Sub-agents / advisors = cyan (locked agent color). Sherlock = violet. */
const ACCENT = "#22d3ee";
const SHERLOCK = "#a855f7";

function agentColor(agent: string) {
  return agent.toLowerCase() === "sherlock" ? SHERLOCK : ACCENT;
}

function TaskDot({ status, color }: { status: DelegationTaskStatus; color: string }) {
  if (status === "running")
    return <Loader2 className="h-3 w-3 shrink-0 animate-spin" style={{ color }} />;
  if (status === "done") return <Check className="h-3 w-3 shrink-0 text-emerald-400" />;
  if (status === "failed") return <X className="h-3 w-3 shrink-0 text-[#ff7480]" />;
  return (
    <CircleDashed
      className={`h-3 w-3 shrink-0 ${
        status === "cancelled" ? "text-muted-foreground/30" : "text-muted-foreground/60"
      }`}
    />
  );
}

function TaskRow({ task }: { task: DelegationTask }) {
  const color = agentColor(task.agent);
  const Icon = task.agent.toLowerCase() === "sherlock" ? ShieldCheck : Users;
  return (
    <div className="flex items-start gap-1.5 rounded-md px-2 py-1 hover:bg-white/[0.03]">
      <span className="mt-[2px]">
        <TaskDot status={task.status} color={color} />
      </span>
      <Icon className="mt-[2px] h-3 w-3 shrink-0" style={{ color }} />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[12px] ${
            task.status === "failed"
              ? "text-[#ff7480]"
              : task.status === "done"
                ? "text-muted-foreground/70"
                : "text-foreground/85"
          }`}
        >
          {task.title}
        </span>
        {task.summary && (
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground/60">
            {task.summary}
          </span>
        )}
      </span>
      <span
        className="mt-[2px] rounded border px-1 py-[1px] font-mono text-[9px] uppercase tracking-wider"
        style={{ borderColor: `${color}33`, color: `${color}cc` }}
      >
        {task.agent}
      </span>
      {task.model && (
        <span className="mt-[2px] max-w-[120px] truncate font-mono text-[9px] text-muted-foreground/45">
          {task.model}
        </span>
      )}
      {typeof task.duration_ms === "number" && task.duration_ms > 0 && (
        <span className="mt-[2px] font-mono text-[9px] text-muted-foreground/50">
          {task.duration_ms >= 1000
            ? `${(task.duration_ms / 1000).toFixed(1)}s`
            : `${task.duration_ms}ms`}
        </span>
      )}
    </div>
  );
}

export default function DelegationTree({ delegation }: { delegation: DelegationPart }) {
  const [open, setOpen] = useState(true);
  const tasks = delegation.tasks ?? [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const failed = tasks.some((t) => t.status === "failed") || delegation.status === "failed";
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (!total && !delegation.goal) return null;

  const label =
    delegation.status === "running"
      ? `${done}/${total}`
      : failed
        ? "failed"
        : delegation.status === "cancelled"
          ? "cancelled"
          : "done";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 overflow-hidden rounded-lg border border-[#22d3ee]/20 bg-white/[0.015] backdrop-blur-sm"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/[0.03]"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        )}
        <Network
          className={`h-3.5 w-3.5 text-[#22d3ee] ${
            delegation.status === "running" ? "animate-pulse" : ""
          }`}
        />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
          delegation
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/90">
          {delegation.goal ?? `${total} sub-agent task${total === 1 ? "" : "s"}`}
        </span>
        {delegation.parent_agent && (
          <span className="rounded border border-white/[0.06] bg-white/[0.02] px-1 py-[1px] font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            {delegation.parent_agent}
          </span>
        )}
        <span
          className={`font-mono text-[9px] uppercase tracking-wider ${
            failed
              ? "text-[#ff7480]"
              : delegation.status === "done"
                ? "text-emerald-400"
                : "text-muted-foreground/60"
          }`}
        >
          {label}
        </span>
      </button>

      <div className="h-[2px] w-full bg-white/[0.04]">
        <motion.div
          className="h-full"
          style={{ background: failed ? "#ff7480" : ACCENT }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="py-1">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
