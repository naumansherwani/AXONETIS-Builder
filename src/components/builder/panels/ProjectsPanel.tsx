/**
 * Projects panel — switch between HostFlow / ANEXVOT AI PAY / AXONETIS.
 * LIVE per-project bridge health from Hetzner brain.
 */
import { useEffect, useState } from "react";
import { useBuilder } from "@/lib/builder-state";
import { PROJECTS, type ProjectId } from "@/lib/projects";
import { getBridgeHealth } from "@/lib/hostflow-api";
import { Check, Loader2 } from "lucide-react";
import { PanelSection } from "./PanelChrome";

type Health = "loading" | "online" | "degraded" | "offline";

const DOT: Record<Health, string> = {
  loading: "bg-white/20",
  online: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]",
  degraded: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
  offline: "bg-red-500/70",
};

const LABEL: Record<Health, string> = {
  loading: "checking…",
  online: "online",
  degraded: "degraded",
  offline: "offline",
};

export default function ProjectsPanel() {
  const { project, setProject } = useBuilder();
  const [health, setHealth] = useState<Record<string, Health>>({});

  useEffect(() => {
    let alive = true;
    setHealth((h) => Object.fromEntries(PROJECTS.map((p) => [p.id, h[p.id] ?? "loading"])));
    PROJECTS.forEach((p) => {
      getBridgeHealth(p.id)
        .then((r) => {
          if (!alive) return;
          const s = (r?.status ?? "").toLowerCase();
          const state: Health =
            s === "ok" || s === "online" || s === "healthy"
              ? "online"
              : s === "degraded" || s === "warn"
                ? "degraded"
                : "offline";
          setHealth((h) => ({ ...h, [p.id]: state }));
        })
        .catch(() => alive && setHealth((h) => ({ ...h, [p.id]: "offline" })));
    });
    const iv = setInterval(() => {
      PROJECTS.forEach((p) => {
        getBridgeHealth(p.id)
          .then((r) => {
            if (!alive) return;
            const s = (r?.status ?? "").toLowerCase();
            setHealth((h) => ({
              ...h,
              [p.id]:
                s === "ok" || s === "online" || s === "healthy"
                  ? "online"
                  : s === "degraded" || s === "warn"
                    ? "degraded"
                    : "offline",
            }));
          })
          .catch(() => alive && setHealth((h) => ({ ...h, [p.id]: "offline" })));
      });
    }, 15000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <PanelSection
      title="Workspace Projects"
      action={<span className="text-[10px] text-muted-foreground/60">{PROJECTS.length}</span>}
    >
      <div className="flex flex-col gap-1">
        {PROJECTS.map((p) => {
          const active = p.id === project;
          const state: Health = health[p.id] ?? "loading";
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
                style={{
                  background: `${p.accent}26`,
                  color: "#fff",
                  boxShadow: `0 0 14px ${p.accent}55`,
                }}
              >
                {p.shortName.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-foreground/95">
                  {p.name}
                </div>
                <div className="truncate font-mono text-[10px] text-muted-foreground/70">
                  {p.previewUrl}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${DOT[state]}`} />
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
                    bridge · {LABEL[state]}
                  </span>
                  {state === "loading" && (
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground/50" />
                  )}
                </div>
              </div>
              {active && <Check className="h-4 w-4 text-[#ff7480]" />}
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}
