/**
 * Claude-style live activity log.
 * Replaces the dead "Live stream connect…" shimmer with a real, connected
 * timeline of what the agent is actually doing right now: connect → route →
 * plan → tools → tokens → verify → answer. Every step comes from a real SSE
 * event, nothing is faked.
 */
import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { ActivityKind, ActivityStep } from "@/lib/project-workspace";

const TONE: Record<ActivityKind, string> = {
  connect: "#60a5fa",
  route: "#60a5fa",
  plan: "#E50914",
  tool: "#fbbf24",
  token: "#34d399",
  verify: "#a855f7",
  answer: "#34d399",
  error: "#f87171",
};

export default function ThinkingLog({
  steps,
  running,
  thoughtMs,
  startedAt,
}: {
  steps: ActivityStep[];
  running: boolean;
  thoughtMs?: number;
  startedAt?: number;
}) {
  const [open, setOpen] = useState(running);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running) setOpen(false);
  }, [running]);

  if (steps.length === 0 && !running) return null;

  const base = startedAt ?? steps[0]?.at ?? now;
  const elapsed = running ? now - base : (thoughtMs ?? 0);
  const seconds = Math.max(0, Math.round(elapsed / 1000));
  const last = steps[steps.length - 1];

  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group/th inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-[3px] text-[10.5px] text-muted-foreground/85 transition-colors hover:border-white/[0.14] hover:text-foreground"
      >
        {running ? (
          <Loader2 className="h-3 w-3 animate-spin text-[#ff7480]" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        )}
        <span className="font-medium">
          {running ? `Thinking… ${seconds}s` : `Thought for ${seconds}s`}
        </span>
        {running && last && (
          <span className="max-w-[220px] truncate text-muted-foreground/60">· {last.label}</span>
        )}
        <ChevronRight
          className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""} text-muted-foreground/50`}
        />
      </button>

      {open && steps.length > 0 && (
        <ol className="relative mt-1.5 space-y-1 border-l border-white/[0.08] pl-3">
          {steps.map((s) => (
            <li key={s.id} className="relative">
              <span
                className={`absolute -left-[17px] top-[5px] h-2 w-2 rounded-full ${
                  s.status === "running" ? "animate-pulse" : ""
                }`}
                style={{
                  background: s.status === "error" ? TONE.error : TONE[s.kind],
                  boxShadow: `0 0 8px ${s.status === "error" ? TONE.error : TONE[s.kind]}`,
                }}
              />
              <div className="flex items-baseline gap-2">
                <span className="text-[10.5px] font-medium text-foreground/85">{s.label}</span>
                <span className="font-mono text-[9px] text-muted-foreground/45">
                  +{Math.max(0, Math.round((s.at - base) / 100) / 10)}s
                </span>
              </div>
              {s.detail && (
                <div className="line-clamp-2 text-[9.5px] leading-relaxed text-muted-foreground/70">
                  {s.detail}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
