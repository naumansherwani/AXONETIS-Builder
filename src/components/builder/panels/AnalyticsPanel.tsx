/**
 * Analytics panel — LIVE cost meter, token burn, error rate, provider health.
 * Wires to `listActivity()` (HostFlow bridge) + `getBridgeHealth()`.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PanelSection, Row, Dot } from "./PanelChrome";
import { listActivity, getBridgeHealth, type AgentActivity } from "@/lib/hostflow-api";
import { useBuilder } from "@/lib/builder-state";

interface Metric { label: string; value: string; tone: "emerald" | "amber" | "red" | "gray" }
interface Provider { name: string; status: string; tone: "emerald" | "amber" | "red" | "gray" }

const ZERO_METRICS: Metric[] = [
  { label: "Today spend", value: "$0.00", tone: "emerald" },
  { label: "Tokens (24h)", value: "0", tone: "gray" },
  { label: "Avg latency", value: "—", tone: "gray" },
  { label: "Errors (24h)", value: "0", tone: "emerald" },
];

function computeMetrics(activity: AgentActivity[]): Metric[] {
  if (!activity.length) return ZERO_METRICS;
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const recent = activity.filter((a) => new Date(a.created_at).getTime() >= cutoff);
  const spend = recent.reduce((s, a) => s + (a.cost_usd ?? 0), 0);
  const tokens = recent.reduce((s, a) => s + (a.tokens_in ?? 0) + (a.tokens_out ?? 0), 0);
  const withDur = recent.filter((a) => typeof a.duration_ms === "number" && a.duration_ms! > 0);
  const avgLat = withDur.length ? withDur.reduce((s, a) => s + (a.duration_ms ?? 0), 0) / withDur.length : null;
  const errs = recent.filter((a) => a.status === "error" || a.kind === "error").length;
  return [
    { label: "Today spend", value: `$${spend.toFixed(4)}`, tone: spend > 5 ? "amber" : "emerald" },
    { label: "Tokens (24h)", value: tokens.toLocaleString(), tone: "gray" },
    { label: "Avg latency", value: avgLat ? `${Math.round(avgLat)}ms` : "—", tone: avgLat && avgLat > 4000 ? "amber" : "gray" },
    { label: "Errors (24h)", value: String(errs), tone: errs > 0 ? "red" : "emerald" },
  ];
}

export default function AnalyticsPanel() {
  const { project } = useBuilder();
  const [metrics, setMetrics] = useState<Metric[]>(ZERO_METRICS);
  const [providers, setProviders] = useState<Provider[]>([
    { name: "OpenRouter", status: "configured", tone: "amber" },
    { name: "Groq", status: "configured", tone: "amber" },
    { name: "Hetzner brain", status: "checking…", tone: "gray" },
  ]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);

    Promise.allSettled([
      listActivity({ projectId: project, limit: 500 }),
      getBridgeHealth(project),
    ]).then(([actRes, healthRes]) => {
      if (!alive) return;
      if (actRes.status === "fulfilled") {
        setMetrics(computeMetrics(actRes.value ?? []));
      } else {
        setErr("bridge offline");
      }
      setProviders((prev) => {
        const next = [...prev];
        if (healthRes.status === "fulfilled" && healthRes.value?.status) {
          const ok = healthRes.value.status === "ok" || healthRes.value.status === "online";
          next[2] = { name: "Hetzner brain", status: healthRes.value.status, tone: ok ? "emerald" : "amber" };
          next[0] = { ...next[0], tone: ok ? "emerald" : "amber", status: ok ? "online" : "configured" };
          next[1] = { ...next[1], tone: ok ? "emerald" : "amber", status: ok ? "online" : "configured" };
        } else {
          next[2] = { name: "Hetzner brain", status: "offline", tone: "red" };
        }
        return next;
      });
    }).finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [project]);

  return (
    <div>
      <PanelSection
        title="Cost & Throughput"
        action={loading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" /> : <span className="text-[10px] text-muted-foreground/60">24h</span>}
      >
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-md border border-white/[0.06] bg-white/[0.015] p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{m.label}</div>
              <div className={`mt-0.5 font-mono text-[15px] font-semibold ${
                m.tone === "red" ? "text-red-300" :
                m.tone === "amber" ? "text-amber-300" :
                m.tone === "emerald" ? "text-emerald-300" :
                "text-foreground/95"
              }`}>{m.value}</div>
            </div>
          ))}
        </div>
        {err && (
          <div className="mt-2 rounded-md border border-red-500/20 bg-red-500/[0.04] px-2 py-1.5 text-[10px] text-red-300/85">
            {err}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Providers">
        <div className="flex flex-col">
          {providers.map((p) => (
            <Row key={p.name} left={<><Dot tone={p.tone} /><span>{p.name}</span></>} right={p.status} />
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
