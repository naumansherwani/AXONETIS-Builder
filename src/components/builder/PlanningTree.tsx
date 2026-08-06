/**
 * Phase 3.10.2 (Intelligence Layer) — sub-step 1: Planning Tree
 *
 * Jimmy execution se pehle plan emit karta hai. Server contract — a part on
 * `agent_thread_messages.parts`:
 *
 *   {
 *     type: "plan",
 *     plan_id: "uuid",
 *     goal: "Add Stripe checkout",
 *     status: "planning" | "running" | "done" | "failed",
 *     nodes: [
 *       { id, title, kind: "task"|"verify"|"subagent", status, parent_id?,
 *         detail?, agent?, tool?, cost_usd?, duration_ms? }
 *     ]
 *   }
 *
 * Zero dummy: agar row mein `plan` part nahi hai, ye component render hi nahi
 * hota. Node status live Realtime update se aata hai (worker row ko update
 * karta hai / naya part emit karta hai).
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  GitBranch,
  Loader2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

export type PlanNodeStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type PlanNodeKind = "task" | "verify" | "subagent";
export type PlanStatus = "planning" | "running" | "done" | "failed";

export interface PlanNode {
  id: string;
  title: string;
  kind: PlanNodeKind;
  status: PlanNodeStatus;
  parent_id?: string;
  detail?: string;
  agent?: string;
  tool?: string;
  cost_usd?: number;
  duration_ms?: number;
}

export interface PlanPart {
  plan_id?: string;
  goal: string;
  status: PlanStatus;
  nodes: PlanNode[];
}

const KIND_ICON: Record<PlanNodeKind, typeof GitBranch> = {
  task: GitBranch,
  verify: ShieldCheck,
  subagent: Users,
};

const KIND_ACCENT: Record<PlanNodeKind, string> = {
  task: "text-[#E50914]",
  verify: "text-[#a855f7]",
  subagent: "text-[#22d3ee]",
};

function StatusDot({ status }: { status: PlanNodeStatus }) {
  if (status === "running")
    return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#E50914]" />;
  if (status === "done") return <Check className="h-3 w-3 shrink-0 text-emerald-400" />;
  if (status === "failed") return <X className="h-3 w-3 shrink-0 text-[#ff7480]" />;
  return (
    <CircleDashed
      className={`h-3 w-3 shrink-0 ${status === "skipped" ? "text-muted-foreground/30" : "text-muted-foreground/60"}`}
    />
  );
}

interface TreeNode extends PlanNode {
  children: TreeNode[];
}

function buildTree(nodes: PlanNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) map.set(n.id, { ...n, children: [] });
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const node = map.get(n.id)!;
    const parent = n.parent_id ? map.get(n.parent_id) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function NodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const Icon = KIND_ICON[node.kind] ?? GitBranch;
  const hasKids = node.children.length > 0;

  return (
    <div>
      <div
        className="group flex items-start gap-1.5 rounded-md px-1.5 py-1 hover:bg-white/[0.03]"
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {hasKids ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-[2px] text-muted-foreground/60 hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="mt-[2px] w-3" />
        )}
        <span className="mt-[2px]">
          <StatusDot status={node.status} />
        </span>
        <Icon className={`mt-[2px] h-3 w-3 shrink-0 ${KIND_ACCENT[node.kind]}`} />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[12px] ${
              node.status === "done"
                ? "text-muted-foreground/70"
                : node.status === "running"
                  ? "text-foreground"
                  : "text-foreground/80"
            }`}
          >
            {node.title}
          </span>
          {node.detail && (
            <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground/60">
              {node.detail}
            </span>
          )}
        </span>
        {node.agent && (
          <span className="mt-[2px] rounded border border-white/[0.06] bg-white/[0.02] px-1 py-[1px] font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            {node.agent}
          </span>
        )}
        {typeof node.duration_ms === "number" && node.duration_ms > 0 && (
          <span className="mt-[2px] font-mono text-[9px] text-muted-foreground/50">
            {node.duration_ms >= 1000
              ? `${(node.duration_ms / 1000).toFixed(1)}s`
              : `${node.duration_ms}ms`}
          </span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {hasKids && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            {node.children.map((c) => (
              <NodeRow key={c.id} node={c} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PlanningTree({ plan }: { plan: PlanPart }) {
  const [open, setOpen] = useState(true);
  const tree = useMemo(() => buildTree(plan.nodes ?? []), [plan.nodes]);

  const total = plan.nodes?.length ?? 0;
  const done = plan.nodes?.filter((n) => n.status === "done").length ?? 0;
  const failed = plan.nodes?.some((n) => n.status === "failed");
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (!total && !plan.goal) return null;

  const statusLabel =
    plan.status === "planning"
      ? "planning"
      : plan.status === "running"
        ? `${done}/${total}`
        : plan.status === "failed" || failed
          ? "failed"
          : "complete";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.015] backdrop-blur-sm"
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
        <GitBranch className="h-3.5 w-3.5 text-[#E50914]" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
          plan
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/90">{plan.goal}</span>
        <span
          className={`font-mono text-[9px] uppercase tracking-wider ${
            plan.status === "failed" || failed
              ? "text-[#ff7480]"
              : plan.status === "done"
                ? "text-emerald-400"
                : "text-muted-foreground/60"
          }`}
        >
          {statusLabel}
        </span>
      </button>

      <div className="h-[2px] w-full bg-white/[0.04]">
        <motion.div
          className={`h-full ${failed ? "bg-[#ff7480]" : "bg-[#E50914]"}`}
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
              {tree.map((n) => (
                <NodeRow key={n.id} node={n} depth={0} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
