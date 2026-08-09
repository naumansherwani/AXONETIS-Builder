/**
 * Phase 10.15 — Command Center telemetry strip.
 * System health gauge (CPU/RAM/Disk) · AI load chart (rpm) · daily cost chart ·
 * active users · revenue chart. All fed by the real-time SSE telemetry stream.
 */
import { useEffect, useMemo, useState } from "react";
import { Activity, Cpu, DollarSign, HardDrive, MemoryStick, TrendingUp, Users } from "lucide-react";
import { PanelSection } from "./panels/PanelChrome";
import { useBuilder } from "@/lib/builder-state";
import {
  fetchTelemetry,
  openTelemetryStream,
  sparklinePath,
  type AiLoadPoint,
  type CostPoint,
  type RevenuePoint,
  type SystemHealth,
} from "@/lib/telemetry-api";

const MAX_POINTS = 40;

function Gauge({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Cpu;
  tone: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color: tone }} />
        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="ml-auto font-mono text-[10.5px] text-foreground/90">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: tone, boxShadow: `0 0 10px -2px ${tone}` }}
        />
      </div>
    </div>
  );
}

function Spark({
  values,
  tone,
  height = 34,
}: {
  values: number[];
  tone: string;
  height?: number;
}) {
  const path = useMemo(() => sparklinePath(values, 240, height), [values, height]);
  if (values.length < 2) {
    return (
      <div className="grid h-[34px] place-items-center text-[9.5px] text-muted-foreground/70">
        data aa raha hai…
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 240 ${height}`} className="h-[34px] w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={tone} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function TelemetryStrip() {
  const { project } = useBuilder();
  const [system, setSystem] = useState<SystemHealth | null>(null);
  const [ai, setAi] = useState<AiLoadPoint[]>([]);
  const [cost, setCost] = useState<CostPoint[]>([]);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [users, setUsers] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchTelemetry(project).then((snap) => {
      if (!alive || !snap) return;
      setSystem(snap.system);
      setAi(snap.ai.slice(-MAX_POINTS));
      setCost(snap.cost.slice(-30));
      setRevenue(snap.revenue.slice(-30));
      setUsers(snap.activeUsers);
    });
    const close = openTelemetryStream(project, {
      onSystem: (s) => {
        setLive(true);
        setSystem(s);
      },
      onAi: (p) => setAi((prev) => [...prev, p].slice(-MAX_POINTS)),
      onCost: (p) =>
        setCost((prev) => [...prev.filter((x) => x.day !== p.day), p].slice(-30)),
      onRevenue: (p) =>
        setRevenue((prev) => [...prev.filter((x) => x.day !== p.day), p].slice(-30)),
      onUsers: (n) => setUsers(n),
    });
    return () => {
      alive = false;
      setLive(false);
      close();
    };
  }, [project]);

  const todayCost = cost.length > 0 ? cost[cost.length - 1].usd : 0;
  const todayRevenue = revenue.length > 0 ? revenue[revenue.length - 1].usd : 0;

  return (
    <>
      <PanelSection
        title="System health"
        action={
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider">
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-white/25"}`}
            />
            <span className={live ? "text-emerald-300" : "text-muted-foreground"}>
              {live ? "live" : "idle"}
            </span>
          </span>
        }
      >
        <div className="grid grid-cols-3 gap-1.5">
          <Gauge label="CPU" value={system?.cpu ?? 0} icon={Cpu} tone="#E50914" />
          <Gauge label="RAM" value={system?.ram ?? 0} icon={MemoryStick} tone="#a855f7" />
          <Gauge label="Disk" value={system?.disk ?? 0} icon={HardDrive} tone="#22d3ee" />
        </div>
      </PanelSection>

      <PanelSection
        title="AI load"
        action={
          <span className="font-mono text-[9.5px] text-muted-foreground/80">
            {ai.length > 0 ? `${ai[ai.length - 1].rpm} rpm` : "—"}
          </span>
        }
      >
        <Spark values={ai.map((p) => p.rpm)} tone="#22d3ee" />
      </PanelSection>

      <PanelSection
        title="Daily spend"
        action={
          <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-[#ff7480]">
            <DollarSign className="h-2.5 w-2.5" />
            {todayCost.toFixed(2)}
          </span>
        }
      >
        <Spark values={cost.map((p) => p.usd)} tone="#E50914" />
      </PanelSection>

      <PanelSection
        title="Revenue"
        action={
          <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-emerald-300">
            <TrendingUp className="h-2.5 w-2.5" />
            {todayRevenue.toFixed(2)}
          </span>
        }
      >
        <Spark values={revenue.map((p) => p.usd)} tone="#34d399" />
        <div className="mt-1.5 flex items-center gap-3 px-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {users} active
          </span>
          <span className="inline-flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {system?.uptimeSeconds
              ? `${Math.floor(system.uptimeSeconds / 3600)}h uptime`
              : "uptime —"}
          </span>
        </div>
      </PanelSection>
    </>
  );
}
