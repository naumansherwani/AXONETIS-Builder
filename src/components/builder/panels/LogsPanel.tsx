/**
 * Logs panel — LIVE activity stream from Hetzner bridge (SSE).
 * Initial fetch via `listActivity()`, then real-time updates via `subscribeActivity()`.
 * Preview bridge events append as `preview/*` entries.
 */
import { useEffect, useMemo, useState } from "react";
import { useBuilder } from "@/lib/builder-state";
import { listActivity, subscribeActivity, type AgentActivity } from "@/lib/hostflow-api";

type Level = "info" | "warn" | "error" | "ok";
interface Log { id: string; t: string; level: Level; src: string; msg: string }

const COLOR: Record<Level, string> = {
  info: "text-sky-300",
  warn: "text-amber-300",
  error: "text-red-400",
  ok: "text-emerald-300",
};

function levelFor(a: AgentActivity): Level {
  if (a.status === "error" || a.kind === "error") return "error";
  if (a.kind === "fix" || a.kind === "rollback") return "warn";
  if (a.kind === "deploy" || a.kind === "build") return "ok";
  return "info";
}

function timeStr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function toLog(a: AgentActivity): Log {
  return {
    id: a.id,
    t: timeStr(a.created_at),
    level: levelFor(a),
    src: a.agent_slug,
    msg: a.summary,
  };
}

export default function LogsPanel() {
  const { project, lastBridgeEvent } = useBuilder();
  const [logs, setLogs] = useState<Log[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [err, setErr] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    let alive = true;
    setStatus("connecting");
    setErr(null);
    listActivity({ projectId: project, limit: 60 })
      .then((rows) => {
        if (!alive) return;
        setLogs((rows ?? []).map(toLog).reverse());
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : String(e));
        setStatus("offline");
      });
    return () => { alive = false; };
  }, [project]);

  // Live SSE
  useEffect(() => {
    const close = subscribeActivity(
      (a) => {
        if (project && a.project_id && a.project_id !== project) return;
        setStatus("live");
        setLogs((prev) => [...prev.slice(-80), toLog(a)]);
      },
      () => setStatus("offline"),
    );
    // If VITE_HOSTFLOW_SERVER_URL missing, subscribe returns a noop; mark offline.
    const t = setTimeout(() => setStatus((s) => (s === "connecting" ? "offline" : s)), 3000);
    return () => { clearTimeout(t); close(); };
  }, [project]);

  // Bridge events → append
  useEffect(() => {
    if (!lastBridgeEvent) return;
    const d = new Date(lastBridgeEvent.receivedAt);
    const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    setLogs((prev) => [
      ...prev.slice(-80),
      { id: `bridge-${lastBridgeEvent.receivedAt}`, t, level: lastBridgeEvent.level, src: "preview", msg: lastBridgeEvent.summary },
    ]);
  }, [lastBridgeEvent]);

  const statusPill = useMemo(() => {
    if (status === "live") return <span className="font-mono text-[10px] text-emerald-300">● live</span>;
    if (status === "connecting") return <span className="font-mono text-[10px] text-amber-300">○ connecting</span>;
    return <span className="font-mono text-[10px] text-red-300">○ offline</span>;
  }, [status]);

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/40 p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/80">Stream</span>
        {statusPill}
      </div>
      {err && (
        <div className="mb-1 rounded-md border border-red-500/20 bg-red-500/[0.04] px-2 py-1 text-[10px] text-red-300/85">
          {err}
        </div>
      )}
      <div className="fb-no-scrollbar max-h-[60vh] overflow-y-auto font-mono text-[11px] leading-relaxed">
        {logs.length === 0 ? (
          <div className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">
            {status === "offline" ? "Bridge offline — waiting for reconnection." : "Awaiting activity…"}
          </div>
        ) : logs.map((l) => (
          <div key={l.id} className="flex gap-2 px-1 py-0.5 hover:bg-white/[0.03]">
            <span className="text-muted-foreground/60">{l.t}</span>
            <span className={`w-12 uppercase ${COLOR[l.level]}`}>{l.level}</span>
            <span className="w-16 text-muted-foreground/80">{l.src}</span>
            <span className="flex-1 text-foreground/85">{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
