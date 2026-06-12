/**
 * Agents panel — Jimmy, Sherlock, 8 industry advisors live monitor.
 * Phase 2 visual: matches `ai_agent_identities` schema (model, status, last task, tokens).
 */
import { PanelSection, Row, Dot } from "./PanelChrome";

interface Agent {
  name: string;
  role: string;
  model: string;
  status: "online" | "thinking" | "idle" | "offline";
  lastTask?: string;
  tokens?: string;
}

const SUPREME: Agent[] = [
  { name: "Jimmy", role: "Build · Design · Architect", model: "Hermes 405B + Qwen3 Coder 480B", status: "idle", lastTask: "Awaiting first build", tokens: "0" },
  { name: "Sherlock", role: "Review · Debug · RCA", model: "DeepSeek R1 + GPT-OSS 120B", status: "idle", lastTask: "Standing by", tokens: "0" },
];

const ADVISORS: Agent[] = [
  { name: "Aria", role: "Beauty · Salon",      model: "GPT-OSS 120B", status: "idle" },
  { name: "Orion", role: "Restaurant · Food",  model: "GPT-OSS 120B", status: "idle" },
  { name: "Rex", role: "Auto · Mechanics",    model: "GPT-OSS 120B", status: "idle" },
  { name: "Lyra", role: "Healthcare · Clinic", model: "GPT-OSS 120B", status: "idle" },
  { name: "Sage", role: "Legal · Advisory",   model: "GPT-OSS 120B", status: "idle" },
  { name: "Atlas", role: "Logistics · Fleet",  model: "GPT-OSS 120B", status: "idle" },
  { name: "Vega", role: "Real Estate",         model: "GPT-OSS 120B", status: "idle" },
  { name: "Kai", role: "Retail · E-commerce", model: "GPT-OSS 120B", status: "idle" },
];

export default function AgentsPanel() {
  return (
    <div>
      <PanelSection title="Supreme Layer" action={<span className="text-[10px] text-muted-foreground/60">2</span>}>
        <div className="flex flex-col gap-1">
          {SUPREME.map((a) => <AgentRow key={a.name} agent={a} large />)}
        </div>
      </PanelSection>

      <PanelSection title="Industry Advisors" action={<span className="text-[10px] text-muted-foreground/60">8</span>}>
        <div className="flex flex-col gap-0.5">
          {ADVISORS.map((a) => <AgentRow key={a.name} agent={a} />)}
        </div>
      </PanelSection>

      <PanelSection title="Routing">
        <Row
          left={<><Dot tone="sky" /><span>Global Router</span></>}
          right="Llama 3.3 70B"
        />
      </PanelSection>
    </div>
  );
}

function AgentRow({ agent, large }: { agent: Agent; large?: boolean }) {
  const tone =
    agent.status === "online" ? "emerald" :
    agent.status === "thinking" ? "amber" :
    agent.status === "idle" ? "gray" : "red";
  return (
    <div className={`rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03] ${large ? "border border-white/[0.05] bg-white/[0.01]" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dot tone={tone as any} />
          <span className="text-[12px] font-semibold text-foreground/95">{agent.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{agent.role}</span>
        </div>
        {agent.tokens && (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            {agent.tokens} tok
          </span>
        )}
      </div>
      {large && (
        <div className="mt-1 flex items-center justify-between pl-3.5 text-[10px] text-muted-foreground/70">
          <span className="truncate">{agent.model}</span>
          {agent.lastTask && <span className="ml-2 shrink-0 truncate italic">{agent.lastTask}</span>}
        </div>
      )}
    </div>
  );
}
