/**
 * Phase 10.1 — rrweb Replay Viewer.
 * Timeline scrubber (click to jump) · play/pause · speed 0.5/1/2/4 ·
 * console overlay · network overlay · red error markers on the timeline.
 * rrweb Replayer is imported lazily (browser-only, keeps SSR safe).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Pause, Play, Globe, TerminalSquare } from "lucide-react";
import {
  extractOverlays,
  fetchSessionEvents,
  formatDuration,
  type ReplayEvent,
} from "@/lib/replay-api";

const SPEEDS = [0.5, 1, 2, 4] as const;

type ReplayerLike = {
  play: (offset?: number) => void;
  pause: () => void;
  setConfig: (c: Record<string, unknown>) => void;
  getMetaData: () => { totalTime: number };
  destroy?: () => void;
  on?: (event: string, cb: (payload: unknown) => void) => void;
};

export default function ReplayViewer({
  projectId,
  sessionId,
  durationMs,
}: {
  projectId: string;
  sessionId: string;
  durationMs: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<ReplayerLike | null>(null);
  const [events, setEvents] = useState<ReplayEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(durationMs);
  const [overlay, setOverlay] = useState<"console" | "network">("console");

  const parsed = useMemo(() => (events ? extractOverlays(events) : null), [events]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchSessionEvents(projectId, sessionId).then((e) => {
      if (cancelled) return;
      setEvents(e);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, sessionId]);

  // Build the replayer once events are in.
  useEffect(() => {
    if (!events || events.length < 2 || !hostRef.current) return;
    let destroyed = false;
    let raf: number | null = null;
    const host = hostRef.current;

    void (async () => {
      try {
        const mod = (await import("rrweb")) as unknown as {
          Replayer: new (evts: unknown[], opts: Record<string, unknown>) => ReplayerLike;
        };
        if (destroyed) return;
        host.innerHTML = "";
        const r = new mod.Replayer(events as unknown[], {
          root: host,
          speed: 1,
          skipInactive: true,
          mouseTail: false,
          showWarning: false,
          showDebug: false,
        });
        replayerRef.current = r;
        setTotal(r.getMetaData().totalTime || durationMs);

        const startedAt = Date.now();
        const tick = () => {
          if (destroyed) return;
          // rrweb has no public position getter — derive from wall clock while playing.
          setPosition((prev) => (playingRef.current ? Math.min(total, prev + 100) : prev));
          void startedAt;
          raf = window.setTimeout(tick, 100) as unknown as number;
        };
        tick();
      } catch {
        /* rrweb unavailable — graceful */
      }
    })();

    return () => {
      destroyed = true;
      if (raf) clearTimeout(raf);
      replayerRef.current?.destroy?.();
      replayerRef.current = null;
      host.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const playingRef = useRef(false);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const toggle = () => {
    const r = replayerRef.current;
    if (!r) return;
    if (playing) {
      r.pause();
      setPlaying(false);
    } else {
      r.play(position);
      setPlaying(true);
    }
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    replayerRef.current?.setConfig({ speed: s });
  };

  const seek = (ms: number) => {
    const clamped = Math.max(0, Math.min(total, ms));
    setPosition(clamped);
    replayerRef.current?.play(clamped);
    setPlaying(true);
  };

  if (loading) {
    return (
      <div className="grid h-40 place-items-center text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading session…
        </span>
      </div>
    );
  }

  if (!events || events.length < 2) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4 text-[11px] text-muted-foreground">
        Session events available nahi hain (bridge{" "}
        <span className="font-mono">/rpc/rrweb.events</span> pending ya session khali hai).
      </div>
    );
  }

  const pct = total > 0 ? (position / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Stage */}
      <div
        ref={hostRef}
        className="relative h-48 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-black"
      />

      {/* Timeline */}
      <div
        className="relative h-2.5 w-full cursor-pointer rounded-full bg-white/[0.06]"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - rect.left) / rect.width) * total);
        }}
        role="slider"
        aria-label="Replay timeline"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={position}
        tabIndex={0}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#E50914]/70 shadow-[0_0_10px_rgba(229,9,20,0.5)]"
          style={{ width: `${pct}%` }}
        />
        {parsed?.errors.map((at, i) => (
          <span
            key={`${at}-${i}`}
            title={`Error @ ${formatDuration(at)}`}
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff3b30] shadow-[0_0_8px_#ff3b30]"
            style={{ left: `${total > 0 ? (at / total) * 100 : 0}%` }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-foreground/90 hover:bg-white/[0.07]"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatDuration(position)} / {formatDuration(total)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                speed === s
                  ? "bg-[#E50914]/20 text-[#ff7480] ring-1 ring-[#E50914]/40"
                  : "text-muted-foreground hover:bg-white/[0.06]"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Overlays */}
      <div className="flex items-center gap-1">
        <OverlayTab
          active={overlay === "console"}
          onClick={() => setOverlay("console")}
          icon={<TerminalSquare className="h-3 w-3" />}
          label={`Console ${parsed?.console.length ?? 0}`}
        />
        <OverlayTab
          active={overlay === "network"}
          onClick={() => setOverlay("network")}
          icon={<Globe className="h-3 w-3" />}
          label={`Network ${parsed?.network.length ?? 0}`}
        />
      </div>
      <div className="fb-no-scrollbar max-h-40 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/40 p-2 font-mono text-[10px] leading-relaxed">
        {overlay === "console" ? (
          (parsed?.console.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No console output captured.</p>
          ) : (
            parsed?.console.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => seek(c.at)}
                className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-white/[0.05]"
              >
                <span className="shrink-0 text-muted-foreground/60">{formatDuration(c.at)}</span>
                <span
                  className={
                    c.level === "error"
                      ? "text-[#ff6b73]"
                      : c.level === "warn"
                        ? "text-amber-300/90"
                        : "text-foreground/80"
                  }
                >
                  {c.level === "error" && (
                    <AlertTriangle className="mr-1 inline h-3 w-3 align-[-2px]" />
                  )}
                  {c.text || "—"}
                </span>
              </button>
            ))
          )
        ) : (parsed?.network.length ?? 0) === 0 ? (
          <p className="text-muted-foreground">No network activity captured.</p>
        ) : (
          parsed?.network.map((n, i) => (
            <button
              key={i}
              type="button"
              onClick={() => seek(n.at)}
              className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-white/[0.05]"
            >
              <span className="shrink-0 text-muted-foreground/60">{formatDuration(n.at)}</span>
              <span className="shrink-0 text-foreground/70">{n.method}</span>
              <span className="flex-1 truncate text-muted-foreground">{n.url}</span>
              <span
                className={
                  (n.status ?? 0) >= 400
                    ? "shrink-0 text-[#ff6b73]"
                    : "shrink-0 text-emerald-300/80"
                }
              >
                {n.status ?? "—"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function OverlayTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${
        active ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:bg-white/[0.05]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
