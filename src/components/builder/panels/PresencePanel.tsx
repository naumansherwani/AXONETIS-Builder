/**
 * Phase 10.5 — Presence panel: who is live + activity feed.
 */
import { useEffect, useState } from "react";
import { Radio, Users } from "lucide-react";
import { PanelSection } from "./PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  initials,
  joinPresence,
  presenceChannelName,
  relativeTime,
  type ActivityEvent,
  type PresencePeer,
} from "@/lib/presence-api";
import { SUPABASE3_READY } from "@/integrations/supabase3/client";

export default function PresencePanel() {
  const { project } = useBuilder();
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const handle = joinPresence(
      project,
      { name: "Founder", kind: "human" },
      {
        onPeers: setPeers,
        onActivity: (ev) => setFeed((f) => [ev, ...f].slice(0, 40)),
      },
    );
    const onFeed = (e: Event) => {
      const ev = (e as CustomEvent<ActivityEvent>).detail;
      if (ev?.text) setFeed((f) => (f.some((x) => x.id === ev.id) ? f : [ev, ...f].slice(0, 40)));
    };
    window.addEventListener("axonetis:presence:feed", onFeed);
    return () => {
      window.removeEventListener("axonetis:presence:feed", onFeed);
      handle.close();
    };
  }, [project]);

  return (
    <div>
      <PanelSection title="Channel">
        <div className="flex items-center justify-between px-1 py-1">
          <span className="font-mono text-[10.5px] text-muted-foreground">
            {presenceChannelName(project)}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${
              SUPABASE3_READY
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-amber-400/30 bg-amber-400/10 text-amber-300"
            }`}
          >
            <Radio className="h-3 w-3" />
            {SUPABASE3_READY ? "live" : "offline"}
          </span>
        </div>
      </PanelSection>

      <PanelSection title={`Live now · ${peers.length + 1}`}>
        <ul className="space-y-1">
          <li className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#E50914] font-mono text-[9px] font-bold text-black shadow-[0_0_14px_-3px_#E50914]">
              F
            </span>
            <span className="text-[11.5px] text-foreground/95">Founder</span>
            <span className="ml-auto text-[9.5px] uppercase tracking-wider text-muted-foreground">
              you
            </span>
          </li>
          {peers.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span
                className="grid h-6 w-6 place-items-center rounded-full font-mono text-[9px] font-bold text-black"
                style={{ background: p.color, boxShadow: `0 0 14px -3px ${p.color}` }}
              >
                {initials(p.name) || "?"}
              </span>
              <span className="text-[11.5px] text-foreground/95">{p.name}</span>
              <span className="ml-auto text-[9.5px] uppercase tracking-wider text-muted-foreground">
                {p.kind}
              </span>
            </li>
          ))}
          {peers.length === 0 && (
            <li className="flex items-center gap-2 px-2 py-1 text-[10.5px] text-muted-foreground">
              <Users className="h-3 w-3" /> Koi aur peer live nahi.
            </li>
          )}
        </ul>
      </PanelSection>

      <PanelSection title="Activity feed">
        {feed.length === 0 ? (
          <p className="px-1 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
            Abhi koi activity nahi. File edit / agent action hone par yahan live aayega.
          </p>
        ) : (
          <ul className="space-y-1">
            {feed.map((ev) => (
              <li key={ev.id} className="flex items-start gap-2 px-1 py-1">
                <span
                  className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: ev.color, boxShadow: `0 0 8px ${ev.color}` }}
                />
                <span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-foreground/85">
                  <span className="font-semibold" style={{ color: ev.color }}>
                    {ev.actor}
                  </span>{" "}
                  {ev.text}
                </span>
                <span className="shrink-0 text-[9.5px] text-muted-foreground/70">
                  {relativeTime(ev.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}
