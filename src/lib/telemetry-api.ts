/**
 * Phase 10.15 — Command Center telemetry client (real-time SSE).
 *
 * Bridge endpoints (server-snippets/telemetry.routes.ts):
 *   GET /rpc/telemetry.snapshot?projectId → TelemetrySnapshot
 *   GET /rpc/telemetry.stream?projectId   → SSE (system, ai, cost, users, revenue)
 *
 * NO DUPLICATE: CommandCenterPanel already renders projects/pipeline/agents;
 * this adds only the system/AI/cost/revenue telemetry stream.
 */
import { rpc } from "./power-tools-api";

const BRIDGE = (import.meta.env.VITE_HOSTFLOW_BRIDGE_URL as string | undefined) ?? "";

export interface SystemHealth {
  cpu: number; // %
  ram: number; // %
  disk: number; // %
  loadAvg: number | null;
  uptimeSeconds: number | null;
}

export interface AiLoadPoint {
  at: number; // epoch ms
  rpm: number; // requests per minute
}

export interface CostPoint {
  day: string; // YYYY-MM-DD
  usd: number;
}

export interface RevenuePoint {
  day: string;
  usd: number;
}

export interface TelemetrySnapshot {
  system: SystemHealth;
  ai: AiLoadPoint[];
  cost: CostPoint[];
  revenue: RevenuePoint[];
  activeUsers: number;
}

export async function fetchTelemetry(projectId: string): Promise<TelemetrySnapshot | null> {
  return rpc<TelemetrySnapshot>(
    `/rpc/telemetry.snapshot?projectId=${encodeURIComponent(projectId)}`,
  );
}

export interface TelemetryHandlers {
  onSystem: (s: SystemHealth) => void;
  onAi: (p: AiLoadPoint) => void;
  onCost: (p: CostPoint) => void;
  onRevenue: (p: RevenuePoint) => void;
  onUsers: (n: number) => void;
}

export function openTelemetryStream(projectId: string, h: TelemetryHandlers): () => void {
  if (!BRIDGE || typeof window === "undefined") return () => {};
  const es = new EventSource(
    `${BRIDGE}/rpc/telemetry.stream?projectId=${encodeURIComponent(projectId)}`,
  );
  const bind = <T>(name: string, cb: (v: T) => void) =>
    es.addEventListener(name, (e) => {
      try {
        cb(JSON.parse((e as MessageEvent).data) as T);
      } catch {
        /* noop */
      }
    });
  bind<SystemHealth>("system", h.onSystem);
  bind<AiLoadPoint>("ai", h.onAi);
  bind<CostPoint>("cost", h.onCost);
  bind<RevenuePoint>("revenue", h.onRevenue);
  bind<{ count: number }>("users", (v) => h.onUsers(v.count));
  es.onerror = () => es.close();
  return () => es.close();
}

export function gaugeTone(pct: number): string {
  if (pct >= 85) return "#E50914";
  if (pct >= 65) return "#fbbf24";
  return "#34d399";
}

/** Builds an SVG polyline path for a sparkline given values. */
export function sparkline(values: number[], width = 260, height = 56): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
}
