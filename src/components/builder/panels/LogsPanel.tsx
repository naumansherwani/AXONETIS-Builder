/**
 * Logs panel — streaming build + runtime log feed (visual seed for Phase 2).
 * Phase 3 wires to live SSE/Realtime from Hetzner bridge.
 */
import { useEffect, useState } from "react";

type Level = "info" | "warn" | "error" | "ok";
interface Log { id: number; t: string; level: Level; src: string; msg: string }

const SEED: Log[] = [
  { id: 1, t: "12:04:01", level: "info", src: "bridge",   msg: "Postmessage handshake → preview iframe OK" },
  { id: 2, t: "12:04:02", level: "ok",   src: "supabase3", msg: "Realtime channel `project_files` subscribed" },
  { id: 3, t: "12:04:03", level: "info", src: "router",    msg: "Global router: Llama 3.3 70B online" },
  { id: 4, t: "12:04:05", level: "warn", src: "brain",     msg: "Hetzner brain status: offline (awaiting Phase 2 wire)" },
  { id: 5, t: "12:04:08", level: "ok",   src: "build",     msg: "HMR ready · 0 errors · 142ms" },
];

const COLOR: Record<Level, string> = {
  info: "text-sky-300",
  warn: "text-amber-300",
  error: "text-red-400",
  ok: "text-emerald-300",
};

export default function LogsPanel() {
  const [logs, setLogs] = useState<Log[]>(SEED);

  useEffect(() => {
    let id = SEED.length;
    const pool: Omit<Log, "id" | "t">[] = [
      { level: "info", src: "bridge", msg: "heartbeat ping → ok" },
      { level: "ok",   src: "build",  msg: "tsc --noEmit clean" },
      { level: "info", src: "router", msg: "no active task" },
    ];
    const i = setInterval(() => {
      const p = pool[Math.floor(Math.random() * pool.length)];
      const d = new Date();
      const t = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
      setLogs((prev) => [...prev.slice(-80), { ...p, id: ++id, t }]);
    }, 4000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/40 p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/80">Stream</span>
        <span className="font-mono text-[10px] text-emerald-300">● live</span>
      </div>
      <div className="fb-no-scrollbar max-h-[60vh] overflow-y-auto font-mono text-[11px] leading-relaxed">
        {logs.map((l) => (
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
