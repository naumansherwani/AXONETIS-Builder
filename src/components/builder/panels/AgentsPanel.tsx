/**
 * Agents panel — Jimmy, Sherlock, 8 industry advisors live roster.
 * Pulls live status from HostFlow server when configured; falls back to seed.
 */
import { useEffect, useState } from "react";
import { PanelSection, Row, Dot } from "./PanelChrome";
import { listAgents, type AgentInfo } from "@/lib/hostflow-api";

interface Agent {
  slug: string;
  name: string;
  role: string;
  model: string;
  kind: "supreme" | "advisor" | "rapidpay" | "router";
  status: "online" | "thinking" | "idle" | "offline" | "error";
}

const SEED: Agent[] = [
  { slug: "jimmy",    name: "Jimmy",    role: "Build · Design · Architect", model: "Hermes 405B + Qwen3 480B", kind: "supreme",  status: "idle" },
  { slug: "sherlock", name: "Sherlock", role: "Review · Debug · RCA",       model: "DeepSeek R1 + GPT-OSS 120B", kind: "supreme",  status: "idle" },
  { slug: "aria",  name: "Aria",  role: "Beauty · Salon",      model: "GPT-OSS 120B", kind: "advisor", status: "idle" },
  { slug: "orion", name: "Orion", role: "Restaurant · Food",   model: "GPT-OSS 120B", kind: "advisor", status: "idle" },
  { slug: "rex",   name: "Rex",   role: "Auto · Mechanics",    model: "GPT-OSS 120B", kind: "advisor", status: "idle" },
  { slug: "lyra",  name: "Lyra",  role: "Healthcare · Clinic", model: "GPT-OSS 120B", kind: "advisor", status: "idle" },
  { slug: "sage",  name: "Sage",  role: "Legal · Advisory",    model: "GPT-OSS 120B", kind: "advisor", status: "idle" },
  { slug: "atlas", name: "Atlas", role: "Logistics · Fleet",   model: "GPT-OSS 120B", kind: "advisor", status: "idle" },
  { slug: "vega",  name: "Vega",  role: "Real Estate",         model: "GPT-OSS 120B", kind: "advisor", status: "idle" },
  { slug: "kai",   name: "Kai",   role: "Retail · E-commerce", model: "GPT-OSS 120B", kind: "advisor", status: "idle" },
  { slug: "router", name: "Router", role: "Global Routing", model: "Llama 3.3 70B", kind: "router", status: "idle" },
];

function mapAgent(a: AgentInfo): Agent {
  return { slug: a.slug, name: a.name, role: a.role, model: a.model_primary, kind: a.kind, status: a.status };
}

export default function AgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>(SEED);
  const [source, setSource] = useState<"seed" | "live">("seed");

  useEffect(() => {
    let alive = true;
    listAgents()
      .then((rows) => { if (alive && rows?.length) { setAgents(rows.map(mapAgent)); setSource("live"); } })
      .catch(() => { /* keep seed */ });
    return () => { alive = false; };
  }, []);

  const supreme  = agents.filter((a) => a.kind === "supreme");
  const advisors = agents.filter((a) => a.kind === "advisor");
  const router   = agents.find((a) => a.kind === "router");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60">
        <span>{source === "live" ? "live · hostflow" : "seed · offline"}</span>
        <span>{agents.length} agents</span>
      </div>

      <PanelSection title="Supreme Layer" action={<span className="text-[10px] text-muted-foreground/60">{supreme.length}</span>}>
        <div className="flex flex-col gap-1">
          {supreme.map((a) => <AgentRow key={a.slug} agent={a} large />)}
        </div>
      </PanelSection>

      <PanelSection title="Industry Advisors" action={<span className="text-[10px] text-muted-foreground/60">{advisors.length}</span>}>
        <div className="flex flex-col gap-0.5">
          {advisors.map((a) => <AgentRow key={a.slug} agent={a} />)}
        </div>
      </PanelSection>

      {router && (
        <PanelSection title="Routing">
          <Row left={<><Dot tone="sky" /><span>{router.name}</span></>} right={router.model} />
        </PanelSection>
      )}
    </div>
  );
}

function AgentRow({ agent, large }: { agent: Agent; large?: boolean }) {
  const tone =
    agent.status === "online" ? "emerald" :
    agent.status === "thinking" ? "amber" :
    agent.status === "error" ? "red" :
    agent.status === "idle" ? "gray" : "gray";
  return (
    <div className={`rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03] ${large ? "border border-white/[0.05] bg-white/[0.01]" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dot tone={tone as "emerald" | "amber" | "red" | "gray"} />
          <span className="text-[12px] font-semibold text-foreground/95">{agent.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{agent.role}</span>
        </div>
        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{agent.status}</span>
      </div>
      {large && (
        <div className="mt-1 pl-3.5 text-[10px] italic text-muted-foreground/70 truncate">{agent.model}</div>
      )}
    </div>
  );
}
