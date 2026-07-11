/**
 * Tools panel — Tool Registry preview (read-only). Full CRUD lives in Phase 3.10.
 */
import { useEffect, useState } from "react";
import { Wrench, Loader2, Code2, Search, Database, Globe, TerminalSquare, Cpu, Boxes } from "lucide-react";
import { PanelSection, Row } from "./PanelChrome";
import { fetchTools, type ToolEntry } from "@/lib/tools-api";

const ICON: Record<ToolEntry["category"], typeof Wrench> = {
  code: Code2,
  search: Search,
  db: Database,
  http: Globe,
  shell: TerminalSquare,
  ai: Cpu,
  system: Boxes,
};

export default function ToolsPanel() {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTools()
      .then((s) => { if (!alive) return; setTools(s.tools); setLive(s.live); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const byCat = tools.reduce<Record<string, ToolEntry[]>>((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div>
      <PanelSection
        title="Registry"
        action={
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {tools.length} · {live ? "live" : "offline"}
          </span>
        }
      >
        <div className="px-2 py-1 text-[10.5px] leading-relaxed text-muted-foreground/70">
          Tools available to Jimmy, Sherlock, and the 8 advisors. Full CRUD lives in Phase 3.10.
        </div>
      </PanelSection>

      {!tools.length && !loading ? (
        <PanelSection title="—">
          <div className="px-2 py-3 text-[11px] text-muted-foreground/60">
            {live ? "No tools registered." : "Server offline — waiting for brain."}
          </div>
        </PanelSection>
      ) : (
        Object.entries(byCat).map(([cat, rows]) => {
          const Icon = ICON[cat as ToolEntry["category"]] ?? Wrench;
          return (
            <PanelSection
              key={cat}
              title={cat}
              action={<span className="text-[10px] text-muted-foreground/60">{rows.length}</span>}
            >
              <div className="flex flex-col">
                {rows.map((t) => (
                  <Row
                    key={t.name}
                    left={
                      <>
                        <Icon className={`h-3.5 w-3.5 ${t.enabled ? "text-[#ff7480]" : "text-muted-foreground/50"}`} />
                        <span className="font-mono">{t.name}</span>
                      </>
                    }
                    right={
                      <span className="flex items-center gap-2 font-mono">
                        <span className="text-muted-foreground/60">{t.invocations24h}×/24h</span>
                        <span className={t.enabled ? "text-emerald-400" : "text-muted-foreground/50"}>
                          {t.enabled ? "on" : "off"}
                        </span>
                      </span>
                    }
                  />
                ))}
              </div>
            </PanelSection>
          );
        })
      )}
    </div>
  );
}
