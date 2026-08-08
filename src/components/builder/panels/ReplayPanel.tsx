/**
 * Phase 10.1 + 10.2 — Session Replay panel.
 * Session list (duration + event count thumbnail) → replay viewer → Sherlock analysis.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, MonitorPlay, RefreshCw } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import ReplayViewer from "../ReplayViewer";
import ReplayAnalyzer from "../ReplayAnalyzer";
import { listSessions, type SessionMeta } from "@/lib/power-tools-api";
import { formatDuration } from "@/lib/replay-api";
import { useBuilder } from "@/lib/builder-state";

export default function ReplayPanel() {
  const { project } = useBuilder();
  const [sessions, setSessions] = useState<SessionMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SessionMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await listSessions(project);
    setSessions(rows);
    setLoading(false);
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PanelSection
        title="Sessions"
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Refresh sessions"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        }
      >
        {loading ? (
          <div className="grid h-16 place-items-center text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="px-1 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Koi session record nahi hua. rrweb recorder builder UI se events{" "}
            <span className="font-mono">/rpc/rrweb.push</span> par bhejta hai.
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActive(s)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                    active?.id === s.id
                      ? "bg-[#E50914]/12 ring-1 ring-[#E50914]/30"
                      : "hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="grid h-8 w-12 shrink-0 place-items-center rounded border border-white/[0.08] bg-black/60">
                    <MonitorPlay className="h-3.5 w-3.5 text-[#ff6b73]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[11px] text-foreground/90">
                      {s.id.slice(0, 12)}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {new Date(s.startedAt).toLocaleString()} · {s.events} events
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/80">
                    {formatDuration(s.durationMs)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      {active && (
        <>
          <PanelSection title={`Replay · ${active.id.slice(0, 8)}`}>
            <ReplayViewer
              projectId={project}
              sessionId={active.id}
              durationMs={active.durationMs}
            />
          </PanelSection>
          <PanelSection title="Analysis">
            <ReplayAnalyzer projectId={project} sessionId={active.id} />
          </PanelSection>
        </>
      )}
    </div>
  );
}
