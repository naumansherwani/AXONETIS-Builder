/**
 * Agents panel — Jimmy, Sherlock, 8 industry advisors live roster.
 * Pulls live status from HostFlow server when configured; falls back to seed.
 */
import { useEffect, useState } from "react";
import { PanelSection, Row, Dot } from "./PanelChrome";
import { listAgents, listRapidPayAgents, type AgentInfo, type RapidPayAgentInfo } from "@/lib/hostflow-api";

interface Agent {
  slug: string;
  name: string;
  role: string;
  model: string;
  kind: "supreme" | "advisor" | "rapidpay" | "router";
  status: "online" | "thinking" | "idle" | "offline" | "error";
}

interface RapidPayAgent {
  slug: string;
  name: string;
  role: string;
  model: string;
  layer: RapidPayAgentInfo["layer"];
  securityGuardian?: boolean;
}

const SEED: Agent[] = [
  { slug: "jimmy",    name: "Jimmy",    role: "Build · Design · Architect", model: "OpenRouter: Hermes 405B · Qwen3 Coder 480B · Qwen3 Next 80B → Groq → Ollama qwen3:8b", kind: "supreme",  status: "idle" },
  { slug: "sherlock", name: "Sherlock", role: "Review · Debug · RCA",       model: "OpenRouter: DeepSeek R1 · Hermes 405B · GPT-OSS 120B → Groq → Ollama qwen3:8b", kind: "supreme",  status: "idle" },
  { slug: "aria",  name: "Aria",  role: "Beauty · Salon",      model: "OpenRouter: GPT-OSS 120B · Llama 3.3 70B → Groq → Ollama qwen3:4b", kind: "advisor", status: "idle" },
  { slug: "orion", name: "Orion", role: "Restaurant · Food",   model: "OpenRouter: GPT-OSS 120B · Llama 3.3 70B → Groq → Ollama qwen3:4b", kind: "advisor", status: "idle" },
  { slug: "rex",   name: "Rex",   role: "Auto · Mechanics",    model: "OpenRouter: GPT-OSS 120B · Llama 3.3 70B → Groq → Ollama qwen3:4b", kind: "advisor", status: "idle" },
  { slug: "lyra",  name: "Lyra",  role: "Healthcare · Clinic", model: "OpenRouter: GPT-OSS 120B · Llama 3.3 70B → Groq → Ollama qwen3:4b", kind: "advisor", status: "idle" },
  { slug: "sage",  name: "Sage",  role: "Legal · Advisory",    model: "OpenRouter: GPT-OSS 120B · Llama 3.3 70B → Groq → Ollama qwen3:4b", kind: "advisor", status: "idle" },
  { slug: "atlas", name: "Atlas", role: "Logistics · Fleet",   model: "OpenRouter: GPT-OSS 120B · Llama 3.3 70B → Groq → Ollama qwen3:4b", kind: "advisor", status: "idle" },
  { slug: "vega",  name: "Vega",  role: "Real Estate",         model: "OpenRouter: GPT-OSS 120B · Llama 3.3 70B → Groq → Ollama qwen3:4b", kind: "advisor", status: "idle" },
  { slug: "kai",   name: "Kai",   role: "Retail · E-commerce", model: "OpenRouter: GPT-OSS 120B · Llama 3.3 70B → Groq → Ollama qwen3:4b", kind: "advisor", status: "idle" },
  { slug: "router", name: "Router", role: "Global Routing", model: "OpenRouter: Llama 3.3 70B → Groq", kind: "router", status: "idle" },
];

const RAPID_PAY_SEED: RapidPayAgent[] = [
  { slug: "jimmy", name: "AI Jimmy", role: "CEO Autopilot", model: "Hermes 405B · Qwen3 Coder 480B · Qwen3 Next 80B", layer: "supreme" },
  { slug: "sherlock", name: "AI Sherlock", role: "Shared security investigation", model: "DeepSeek R1 · Hermes 405B · GPT-OSS 120B", layer: "security", securityGuardian: true },
  { slug: "ledger-fox", name: "AI Ledger Fox", role: "Ledger intelligence · transaction analysis", model: "GPT-OSS 120B", layer: "treasury" },
  { slug: "recovery-phantom", name: "Recovery Phantom", role: "Payment recovery · retry intelligence", model: "Llama 3.3 70B", layer: "treasury" },
  { slug: "treasury-sentinel", name: "AI Treasury Sentinel", role: "Treasury monitoring · risk detection", model: "Llama 3.3 70B → DeepSeek R1", layer: "security", securityGuardian: true },
  { slug: "corridor-brain", name: "AI Corridor Brain", role: "Cross-border routing", model: "Llama 3.3 70B", layer: "treasury" },
  { slug: "treasury-navigator", name: "AI Treasury Navigator", role: "Treasury decisions · fund routing", model: "Llama 3.3 70B", layer: "treasury" },
  { slug: "runtime-echo", name: "AI Runtime Echo", role: "Runtime monitoring · event analysis", model: "Llama 3.3 70B", layer: "treasury" },
  { slug: "replay-keeper", name: "AI Replay Keeper", role: "Audit replay · reconstruction", model: "Llama 3.3 70B", layer: "treasury" },
  { slug: "settlement-hawk", name: "AI Settlement Hawk", role: "Settlement intelligence", model: "Llama 3.3 70B", layer: "treasury" },
  { slug: "fraud-radar", name: "AI Fraud Radar", role: "Fraud detection · risk escalation", model: "Llama 3.3 70B → DeepSeek R1", layer: "security", securityGuardian: true },
  { slug: "treasury-stress-intelligence", name: "AI Treasury Stress Intelligence", role: "Stress tests · scenarios", model: "Hermes 405B", layer: "intelligence" },
  { slug: "revenue-brain", name: "AI Revenue Brain", role: "Revenue optimization", model: "GPT-OSS 120B", layer: "intelligence" },
  { slug: "explainability-civilization", name: "AI Explainability Civilization", role: "Decision explanations · audits", model: "GPT-OSS 120B", layer: "intelligence" },
  { slug: "founder-sandbox-civilization", name: "AI Founder Sandbox Civilization", role: "Simulation · strategy testing", model: "Hermes 405B", layer: "intelligence" },
  { slug: "global-router", name: "AI Global Router", role: "Agent · tool · route classification", model: "Llama 3.3 70B", layer: "router" },
];

function mapAgent(a: AgentInfo): Agent {
  const configModels = a.routing_config?.primary.models.join(" · ");
  const fallback = [a.routing_config?.secondary?.provider, a.routing_config?.last_resort?.models.join(" · ")]
    .filter(Boolean)
    .join(" → ");
  return {
    slug: a.slug,
    name: a.name,
    role: a.role,
    model: configModels ? `OpenRouter: ${configModels}${fallback ? ` → ${fallback}` : ""}` : a.model_primary,
    kind: a.kind,
    status: a.status,
  };
}

function mapRapidPayAgent(a: RapidPayAgentInfo): RapidPayAgent {
  return {
    slug: a.slug,
    name: a.name,
    role: a.role,
    model: a.routing_config.primary.models.join(" · "),
    layer: a.security_guardian ? "security" : a.layer,
    securityGuardian: a.security_guardian,
  };
}

export default function AgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>(SEED);
  const [rapidPayAgents, setRapidPayAgents] = useState<RapidPayAgent[]>(RAPID_PAY_SEED);
  const [source, setSource] = useState<"seed" | "live">("seed");

  useEffect(() => {
    let alive = true;
    listAgents()
      .then((rows) => { if (alive && rows?.length) { setAgents(rows.map(mapAgent)); setSource("live"); } })
      .catch(() => { /* keep seed */ });
    listRapidPayAgents()
      .then((rows) => { if (alive && rows?.length) setRapidPayAgents(rows.map(mapRapidPayAgent)); })
      .catch(() => { /* ANEXVOT AI PAY lives in Supabase 2 later; keep locked seed contract */ });
    return () => { alive = false; };
  }, []);

  const supreme  = agents.filter((a) => a.kind === "supreme");
  const advisors = agents.filter((a) => a.kind === "advisor");
  const router   = agents.find((a) => a.kind === "router");
  const rapidSecurity = rapidPayAgents.filter((a) => a.securityGuardian);

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

      <PanelSection title="Phase 3 Endpoint Contract" action={<span className="text-[10px] text-muted-foreground/60">10</span>}>
        <div className="grid gap-1 font-mono text-[9px] text-muted-foreground/80">
          {["GET /api/agents", "POST /api/agents/:slug/chat", "POST /api/agents/sherlock/scan", "GET /api/agents/threads", "GET /api/agents/threads/:id/messages", "GET /api/agents/:slug/memory", "POST /api/agents/:slug/memory", "GET /api/agents/activity", "GET /api/agents/activity/stream", "POST /api/agents/router/route"].map((endpoint) => (
            <div key={endpoint} className="truncate rounded bg-white/[0.02] px-2 py-1">{endpoint}</div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="ANEXVOT AI PAY · Supabase 2 Future" action={<span className="text-[10px] text-muted-foreground/60">16 + 3 security</span>}>
        <div className="mb-2 rounded-md border border-amber-400/15 bg-amber-400/[0.03] px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground/85">
          routing_config → OpenRouter → Groq → Ollama. ANEXVOT AI PAY is not inserted into Supabase 3.
        </div>
        <div className="flex flex-col gap-0.5">
          {rapidPayAgents.map((a) => <RapidPayRow key={a.slug} agent={a} />)}
        </div>
      </PanelSection>

      <PanelSection title="Security Guardians" action={<span className="text-[10px] text-muted-foreground/60">{rapidSecurity.length}</span>}>
        <div className="flex flex-col gap-0.5">
          {rapidSecurity.map((a) => (
            <Row key={a.slug} left={<><Dot tone="red" /><span>{a.name}</span></>} right={a.model} />
          ))}
        </div>
      </PanelSection>
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

function RapidPayRow({ agent }: { agent: RapidPayAgent }) {
  const tone =
    agent.securityGuardian ? "red" :
    agent.layer === "supreme" ? "amber" :
    agent.layer === "intelligence" ? "violet" :
    agent.layer === "router" ? "sky" : "emerald";
  return (
    <div className="rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Dot tone={tone as "red" | "amber" | "emerald" | "violet" | "sky"} />
          <span className="truncate text-[11px] font-semibold text-foreground/90">{agent.name}</span>
        </div>
        <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground/60">{agent.layer}</span>
      </div>
      <div className="mt-0.5 truncate pl-3.5 text-[10px] text-muted-foreground/75">{agent.role}</div>
      <div className="mt-0.5 truncate pl-3.5 font-mono text-[9px] text-muted-foreground/60">{agent.model}</div>
    </div>
  );
}
