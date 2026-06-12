/**
 * Versions panel — time-travel: snapshots, diff history, rollback (Phase 6 wires real data).
 */
import { PanelSection, Row } from "./PanelChrome";
import { RotateCcw } from "lucide-react";

const SNAPSHOTS = [
  { id: "v17", label: "phase 1 sql verified", t: "2h ago", current: true },
  { id: "v16", label: "founder lock gate + glow", t: "9h ago" },
  { id: "v15", label: "topbar cinematic redesign", t: "11h ago" },
  { id: "v14", label: "axonetis rename", t: "1d ago" },
  { id: "v13", label: "initial shell scaffold", t: "1d ago" },
];

export default function VersionsPanel() {
  return (
    <PanelSection title="Time Travel">
      <div className="flex flex-col gap-1">
        {SNAPSHOTS.map((s) => (
          <Row
            key={s.id}
            active={s.current}
            left={
              <>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px]">{s.id}</span>
                <span className="truncate">{s.label}</span>
              </>
            }
            right={
              <span className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/70">{s.t}</span>
                {!s.current && <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-[#ff7480]" />}
              </span>
            }
          />
        ))}
      </div>
    </PanelSection>
  );
}
