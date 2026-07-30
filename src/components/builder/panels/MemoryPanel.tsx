/**
 * Memory Inspector — read-only view of agent_memory per agent.
 * Reads from HostFlow `/api/agents/:slug/memory`.
 */
import { useEffect, useState } from "react";
import { PanelSection, Row, Dot } from "./PanelChrome";
import { getAgentMemory, type AgentMemoryRow, type AgentSlug } from "@/lib/hostflow-api";

const AGENTS: { slug: AgentSlug; name: string }[] = [
  { slug: "jimmy", name: "Jimmy" },
  { slug: "sherlock", name: "Sherlock" },
  { slug: "aria", name: "Aria" },
  { slug: "orion", name: "Orion" },
  { slug: "rex", name: "Rex" },
  { slug: "lyra", name: "Lyra" },
  { slug: "sage", name: "Sage" },
  { slug: "atlas", name: "Atlas" },
  { slug: "vega", name: "Vega" },
  { slug: "kai", name: "Kai" },
];

const SCOPE_TONE: Record<string, "emerald" | "violet" | "sky" | "amber" | "gray"> = {
  episodic: "sky",
  semantic: "violet",
  procedural: "amber",
  fact: "emerald",
};

export default function MemoryPanel() {
  const [selected, setSelected] = useState<AgentSlug>("jimmy");
  const [rows, setRows] = useState<AgentMemoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAgentMemory(selected, { limit: 50 })
      .then((data) => {
        if (alive) setRows(data ?? []);
      })
      .catch(() => {
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  return (
    <div>
      <PanelSection
        title="Agent"
        action={<span className="text-[10px] text-muted-foreground/60">{AGENTS.length}</span>}
      >
        <div className="flex flex-col gap-0.5">
          {AGENTS.map((a) => (
            <Row
              key={a.slug}
              active={selected === a.slug}
              onClick={() => setSelected(a.slug)}
              left={
                <>
                  <Dot tone={selected === a.slug ? "emerald" : "gray"} />
                  <span>{a.name}</span>
                </>
              }
              right={a.slug}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection
        title="Memories"
        action={<span className="text-[10px] text-muted-foreground/60">{rows.length}</span>}
      >
        {loading ? (
          <div className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">
            No memories yet for {selected}.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {rows.map((m) => (
              <MemoryRow key={m.id} m={m} />
            ))}
          </div>
        )}
      </PanelSection>
    </div>
  );
}

function MemoryRow({ m }: { m: AgentMemoryRow }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.01] px-2 py-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dot tone={SCOPE_TONE[m.scope] ?? "gray"} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {m.scope}
          </span>
          {m.key && <span className="font-mono text-[9px] text-muted-foreground/60">{m.key}</span>}
        </div>
        <span className="font-mono text-[9px] text-muted-foreground/60">imp {m.importance}</span>
      </div>
      <div className="mt-1 line-clamp-3 text-[11px] text-foreground/85">{m.content}</div>
    </div>
  );
}
