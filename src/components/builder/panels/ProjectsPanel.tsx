/**
 * Projects panel — switch between HostFlow / Rapid Pay / AXONETIS.
 */
import { useBuilder } from "@/lib/builder-state";
import { PROJECTS, type ProjectId } from "@/lib/projects";
import { Check } from "lucide-react";
import { PanelSection } from "./PanelChrome";

export default function ProjectsPanel() {
  const { project, setProject } = useBuilder();
  return (
    <PanelSection title="Workspace Projects" action={<span className="text-[10px] text-muted-foreground/60">{PROJECTS.length}</span>}>
      <div className="flex flex-col gap-1">
        {PROJECTS.map((p) => {
          const active = p.id === project;
          return (
            <button
              key={p.id}
              onClick={() => setProject(p.id as ProjectId)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                active
                  ? "border-[#E50914]/40 bg-[#E50914]/10"
                  : "border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04]"
              }`}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-md border border-white/10 text-[11px] font-bold uppercase"
                style={{ background: `${p.accent}26`, color: "#fff", boxShadow: `0 0 14px ${p.accent}55` }}
              >
                {p.shortName.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-foreground/95">{p.name}</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground/70">{p.previewUrl}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground/45">iframe sandbox target</div>
              </div>
              {active && <Check className="h-4 w-4 text-[#ff7480]" />}
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}
