/**
 * Activity Feed Panel — live tail of agent_activity (chat/build/scan/fix/deploy/etc.)
 * Subscribes to /api/agents/activity/stream SSE; falls back to polling if unavailable.
 */
import { useEffect, useState } from "react";
import { PanelSection, Dot } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import { listActivity, subscribeActivity, type AgentActivity } from "@/lib/hostflow-api";

const KIND_TONE: Record<AgentActivity["kind"], "emerald" | "amber" | "red" | "violet" | "sky" | "gray"> = {
  chat: "sky", build: "violet", scan: "amber", fix: "emerald",
  deploy: "emerald", rollback: "red", memory_write: "gray", route: "sky", error: "red",
};

export default function ActivityFeedPanel() {
  const { project } = useBuilder();
  const [events, setEvents] = useState<AgentActivity[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    listActivity({ projectId: project, limit: 60 })
      .then((rows) => { if (alive) setEvents(rows ?? []); })
      .catch(() => { /* offline */ });

    const close = subscribeActivity(
      (ev) => { setLive(true); setEvents((prev) => [ev, ...prev].slice(0, 100)); },
      () => setLive(false),
    );
    return () => { alive = false; close(); };
  }, [project]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60">
        <span className="flex items-center gap-1.5">
          <Dot tone={live ? "emerald" : "gray"} />
          {live ? "streaming" : "offline"}
        </span>
        <span>{events.length} events</span>
      </div>

      <PanelSection title="Recent Activity">
        {events.length === 0 ? (
          <div className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">
            No agent activity yet. Connect HostFlow server to stream.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {events.map((e) => <ActivityRow key={e.id} ev={e} />)}
          </div>
        )}
      </PanelSection>
    </div>
  );
}

function ActivityRow({ ev }: { ev: AgentActivity }) {
  const time = new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Dot tone={KIND_TONE[ev.kind]} />
          <span className="text-[11px] font-semibold text-foreground/90">{ev.agent_slug}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{ev.kind}</span>
        </div>
        <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">{time}</span>
      </div>
      <div className="mt-0.5 pl-3.5 text-[11px] text-muted-foreground/85 truncate">{ev.summary}</div>
      {(ev.tokens_in > 0 || ev.tokens_out > 0 || ev.duration_ms) && (
        <div className="mt-0.5 flex gap-2 pl-3.5 font-mono text-[9px] text-muted-foreground/60">
          {ev.tokens_in > 0 && <span>↓{ev.tokens_in}</span>}
          {ev.tokens_out > 0 && <span>↑{ev.tokens_out}</span>}
          {ev.duration_ms != null && <span>{ev.duration_ms}ms</span>}
          {ev.cost_usd > 0 && <span>${ev.cost_usd.toFixed(4)}</span>}
        </div>
      )}
    </div>
  );
}
