/**
 * Analytics panel — cost meter, token burn, agent performance.
 */
import { PanelSection, Row, Dot } from "./PanelChrome";

const METRICS = [
  { label: "Today spend", value: "$0.00", tone: "emerald" as const },
  { label: "Tokens (24h)", value: "0", tone: "gray" as const },
  { label: "Avg latency", value: "—", tone: "gray" as const },
  { label: "Errors (24h)", value: "0", tone: "emerald" as const },
];

const PROVIDERS = [
  { name: "OpenRouter", status: "configured", tone: "amber" as const },
  { name: "Groq", status: "configured", tone: "amber" as const },
  { name: "Hetzner brain", status: "offline", tone: "red" as const },
];

export default function AnalyticsPanel() {
  return (
    <div>
      <PanelSection title="Cost & Throughput">
        <div className="grid grid-cols-2 gap-2">
          {METRICS.map((m) => (
            <div key={m.label} className="rounded-md border border-white/[0.06] bg-white/[0.015] p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{m.label}</div>
              <div className="mt-0.5 font-mono text-[15px] font-semibold text-foreground/95">{m.value}</div>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Providers">
        <div className="flex flex-col">
          {PROVIDERS.map((p) => (
            <Row key={p.name} left={<><Dot tone={p.tone} /><span>{p.name}</span></>} right={p.status} />
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
