/**
 * Runtime panel — Phase 5: Preview Bridge + Custom Preview Engine.
 * Execution remains on hostflow-server. This panel reads only.
 */
import { FlaskConical, Radio, Rocket, ShieldCheck, Waypoints, Zap } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { PROJECTS } from "@/lib/projects";
import { Dot, PanelSection, Row } from "./PanelChrome";

export default function RuntimePanel() {
  const { project, bridgeStatus, lastBridgeEvent, previewEnv, lastPreviewChange } = useBuilder();
  const active = PROJECTS.find((p) => p.id === project)!;
  const dot: "emerald" | "amber" | "gray" =
    bridgeStatus === "connected" ? "emerald" : bridgeStatus === "no-signal" ? "amber" : "gray";

  return (
    <>
      <PanelSection
        title="Preview Bridge"
        action={
          <span className="font-mono text-[10px] uppercase text-muted-foreground/70">Phase 3</span>
        }
      >
        <div className="space-y-2">
          <Row
            left={
              <>
                <Dot tone={dot} /> Status
              </>
            }
            right={bridgeStatus}
          />
          <Row
            left={
              <>
                <Waypoints className="h-3.5 w-3.5" /> Domain
              </>
            }
            right={active.shortName}
          />
          <Row
            left={
              <>
                <Radio className="h-3.5 w-3.5" /> Channel
              </>
            }
            right="postMessage"
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Preview Engine"
        action={
          <span className="font-mono text-[10px] uppercase text-muted-foreground/70">Phase 5</span>
        }
      >
        <div className="space-y-2">
          <Row
            left={
              previewEnv === "sandbox" ? (
                <>
                  <FlaskConical className="h-3.5 w-3.5 text-amber-300" /> Environment
                </>
              ) : (
                <>
                  <Rocket className="h-3.5 w-3.5 text-emerald-300" /> Environment
                </>
              )
            }
            right={previewEnv === "sandbox" ? "Sandbox" : "Production"}
          />
          <Row
            left={
              <>
                <Zap className="h-3.5 w-3.5" /> Hot Reload
              </>
            }
            right={previewEnv === "sandbox" ? "Realtime" : "Off"}
          />
          <Row
            left={
              <>
                <ShieldCheck className="h-3.5 w-3.5" /> Source
              </>
            }
            right="project_files"
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Last Signal"
        action={<span className="font-mono text-[10px] text-muted-foreground/60">iframe</span>}
      >
        {lastBridgeEvent ? (
          <div className="space-y-2 rounded-md border border-white/[0.06] bg-black/35 p-2 font-mono text-[11px] leading-relaxed">
            <div className="flex items-center gap-2 text-foreground/90">
              <Dot
                tone={
                  lastBridgeEvent.level === "error"
                    ? "red"
                    : lastBridgeEvent.level === "ok"
                      ? "emerald"
                      : "sky"
                }
              />
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

      <PanelSection
        title="Last HMR Change"
        action={<span className="font-mono text-[10px] text-muted-foreground/60">supabase</span>}
      >
        {lastPreviewChange ? (
          <div className="space-y-1 rounded-md border border-white/[0.06] bg-black/35 p-2 font-mono text-[11px] leading-relaxed">
            <div className="flex items-center gap-2">
              <Dot tone={lastPreviewChange.change === "delete" ? "red" : "emerald"} />
              <span className="uppercase tracking-widest text-muted-foreground/80">
                {lastPreviewChange.change}
              </span>
            </div>
            <div className="truncate text-foreground/90">{lastPreviewChange.path}</div>
          </div>
        ) : (
          <div className="rounded-md border border-white/[0.06] bg-black/35 p-2 text-[12px] text-muted-foreground/75">
            No sandbox file changes yet.
          </div>
        )}
      </PanelSection>

      <PanelSection
        title="Architecture Lock"
        action={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />}
      >
        <div className="space-y-1.5 text-[11px] leading-relaxed text-foreground/80">
          <p>Preview never edits production directly.</p>
          <p>All AI changes land in Sandbox first.</p>
          <p>Founder promotes Sandbox → Production explicitly.</p>
        </div>
      </PanelSection>
    </>
  );
}
