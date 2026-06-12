/**
 * Runtime panel — Phase 3 frontend bridge status only.
 * Execution remains on the existing HostFlow server layer.
 */
import { Radio, ShieldCheck, Waypoints } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { PROJECTS } from "@/lib/projects";
import { Dot, PanelSection, Row } from "./PanelChrome";

export default function RuntimePanel() {
  const { project, bridgeStatus, lastBridgeEvent } = useBuilder();
  const active = PROJECTS.find((p) => p.id === project)!;
  const dot = bridgeStatus === "connected" ? "emerald" : bridgeStatus === "no-signal" ? "amber" : "gray";

  return (
    <>
      <PanelSection title="Preview Bridge" action={<span className="font-mono text-[10px] uppercase text-muted-foreground/70">Phase 3</span>}>
        <div className="space-y-2">
          <Row left={<><Dot tone={dot} /> Status</>} right={bridgeStatus} />
          <Row left={<><Waypoints className="h-3.5 w-3.5" /> Domain</>} right={active.shortName} />
          <Row left={<><Radio className="h-3.5 w-3.5" /> Channel</>} right="postMessage" />
        </div>
      </PanelSection>

      <PanelSection title="Last Signal" action={<span className="font-mono text-[10px] text-muted-foreground/60">iframe</span>}>
        {lastBridgeEvent ? (
          <div className="space-y-2 rounded-md border border-white/[0.06] bg-black/35 p-2 font-mono text-[11px] leading-relaxed">
            <div className="flex items-center gap-2 text-foreground/90">
              <Dot tone={lastBridgeEvent.level === "error" ? "red" : lastBridgeEvent.level === "ok" ? "emerald" : "sky"} />
              <span>{lastBridgeEvent.summary}</span>
            </div>
            <div className="truncate text-muted-foreground/70">{lastBridgeEvent.origin}</div>
          </div>
        ) : (
          <div className="rounded-md border border-white/[0.06] bg-black/35 p-2 text-[12px] text-muted-foreground/75">
            Awaiting preview handshake.
          </div>
        )}
      </PanelSection>

      <PanelSection title="Architecture Lock" action={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />}>
        <div className="space-y-1.5 text-[11px] leading-relaxed text-foreground/80">
          <p>Frontend workspace only.</p>
          <p>Existing HostFlow server remains execution layer.</p>
          <p>No duplicate AI backend, bridge, or Jimmy logic here.</p>
        </div>
      </PanelSection>
    </>
  );
}