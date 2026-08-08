/**
 * Phase 3.10.2 (Intelligence Layer) — sub-step 2: Self-Verification Loop UI
 *
 * Jimmy execute karne ke baad Sherlock ko verify karne bhejta hai. Har pass
 * (attempt) ke checks live update hote hain. Server contract — a part on
 * `agent_thread_messages.parts`:
 *
 *   {
 *     type: "verification",
 *     verify_id: "uuid",
 *     target?: "src/routes/api/x.ts",
 *     agent?: "sherlock",
 *     attempt: 1,
 *     max_attempts: 3,
 *     status: "running" | "pass" | "fail" | "retrying",
 *     verdict?: "PASS" | "FAIL",
 *     fix_summary?: "…",
 *     checks: [
 *       { id, label, kind: "logic"|"security"|"performance"|"build"|"test",
 *         status: "pending"|"running"|"pass"|"fail"|"skipped", detail?, duration_ms? }
 *     ]
 *   }
 *
 * Zero dummy: `verification` part na ho to component render hi nahi hota.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Gauge,
  Hammer,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  TestTube,
  X,
} from "lucide-react";

export type VerifyCheckStatus = "pending" | "running" | "pass" | "fail" | "skipped";
export type VerifyCheckKind = "logic" | "security" | "performance" | "build" | "test";
export type VerifyStatus = "running" | "pass" | "fail" | "retrying";

export interface VerifyCheck {
  id: string;
  label: string;
  kind: VerifyCheckKind;
  status: VerifyCheckStatus;
  detail?: string;
  duration_ms?: number;
}

export interface VerificationPart {
  verify_id?: string;
  target?: string;
  agent?: string;
  attempt: number;
  max_attempts: number;
  status: VerifyStatus;
  verdict?: string;
  fix_summary?: string;
  checks: VerifyCheck[];
}

const KIND_ICON: Record<VerifyCheckKind, typeof ShieldCheck> = {
  logic: Activity,
  security: ShieldAlert,
  performance: Gauge,
  build: Hammer,
  test: TestTube,
};

/** Sherlock = violet (locked agent color). */
const ACCENT = "#a855f7";

function CheckDot({ status }: { status: VerifyCheckStatus }) {
  if (status === "running")
    return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#a855f7]" />;
  if (status === "pass") return <Check className="h-3 w-3 shrink-0 text-emerald-400" />;
  if (status === "fail") return <X className="h-3 w-3 shrink-0 text-[#ff7480]" />;
  return (
    <CircleDashed
      className={`h-3 w-3 shrink-0 ${
        status === "skipped" ? "text-muted-foreground/30" : "text-muted-foreground/60"
      }`}
    />
  );
}

function CheckRow({ check }: { check: VerifyCheck }) {
  const Icon = KIND_ICON[check.kind] ?? Activity;
  return (
    <div className="flex items-start gap-1.5 rounded-md px-2 py-1 hover:bg-white/[0.03]">
      <span className="mt-[2px]">
        <CheckDot status={check.status} />
      </span>
      <Icon className="mt-[2px] h-3 w-3 shrink-0 text-[#a855f7]" />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[12px] ${
            check.status === "fail"
              ? "text-[#ff7480]"
              : check.status === "pass"
                ? "text-muted-foreground/70"
                : "text-foreground/85"
          }`}
        >
          {check.label}
        </span>
        {check.detail && (
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground/60">
            {check.detail}
          </span>
        )}
      </span>
      <span className="mt-[2px] rounded border border-white/[0.06] bg-white/[0.02] px-1 py-[1px] font-mono text-[9px] uppercase tracking-wider text-muted-foreground/55">
        {check.kind}
      </span>
      {typeof check.duration_ms === "number" && check.duration_ms > 0 && (
        <span className="mt-[2px] font-mono text-[9px] text-muted-foreground/50">
          {check.duration_ms >= 1000
            ? `${(check.duration_ms / 1000).toFixed(1)}s`
            : `${check.duration_ms}ms`}
        </span>
      )}
    </div>
  );
}

export default function SelfVerifyLoop({ verification }: { verification: VerificationPart }) {
  const [open, setOpen] = useState(true);
  const checks = verification.checks ?? [];
  const total = checks.length;
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.some((c) => c.status === "fail") || verification.status === "fail";
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const attempt = Math.max(1, verification.attempt || 1);
  const maxAttempts = Math.max(attempt, verification.max_attempts || attempt);

  if (!total && !verification.target && !verification.verdict) return null;

  const label =
    verification.status === "retrying"
      ? `retry ${attempt}/${maxAttempts}`
      : verification.status === "running"
        ? `${passed}/${total}`
        : failed
          ? "fail"
          : "pass";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 overflow-hidden rounded-lg border border-[#a855f7]/20 bg-white/[0.015] backdrop-blur-sm"
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
        {verification.status === "retrying" ? (
          <RotateCcw className="h-3.5 w-3.5 animate-spin text-[#a855f7]" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 text-[#a855f7]" />
        )}
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
          self-verify
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/90">
          {verification.target ?? verification.verdict ?? "verification pass"}
        </span>
        {verification.agent && (
          <span className="rounded border border-white/[0.06] bg-white/[0.02] px-1 py-[1px] font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            {verification.agent}
          </span>
        )}
        <span
          className={`font-mono text-[9px] uppercase tracking-wider ${
            failed
              ? "text-[#ff7480]"
              : verification.status === "pass"
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
            {maxAttempts > 1 && (
              <div className="flex items-center gap-1 px-2.5 pt-1.5">
                {Array.from({ length: maxAttempts }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i + 1 < attempt
                        ? "bg-[#a855f7]/50"
                        : i + 1 === attempt
                          ? failed
                            ? "bg-[#ff7480]"
                            : "bg-[#a855f7]"
                          : "bg-white/[0.06]"
                    }`}
                  />
                ))}
                <span className="ml-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">
                  pass {attempt}/{maxAttempts}
                </span>
              </div>
            )}
            <div className="py-1">
              {checks.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </div>
            {verification.fix_summary && (
              <div className="border-t border-white/[0.05] px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground/75">
                <span className="mr-1 font-mono text-[9px] uppercase tracking-wider text-[#a855f7]">
                  fix
                </span>
                {verification.fix_summary}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
