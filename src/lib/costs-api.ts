/**
 * Costs API — reads token burn + $ cost from Hetzner NEXATECT-Engine.
 * Endpoint: GET /api/agents/founder/costs?window=24h
 * Falls back to zeroed totals if server unreachable (never throws to UI).
 */
const BASE = (import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export interface CostModelRow {
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface CostsSnapshot {
  window: "1h" | "24h" | "7d" | "30d";
  total_usd: number;
  total_requests: number;
  total_tokens: number;
  by_model: CostModelRow[];
  live: boolean;
  fetched_at: string;
}

const EMPTY: CostsSnapshot = {
  window: "24h",
  total_usd: 0,
  total_requests: 0,
  total_tokens: 0,
  by_model: [],
  live: false,
  fetched_at: new Date().toISOString(),
};

export async function fetchCosts(window: CostsSnapshot["window"] = "24h"): Promise<CostsSnapshot> {
  try {
    if (!BASE) return { ...EMPTY, window };
    const res = await fetch(`${BASE}/api/agents/founder/costs?window=${window}`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { ...EMPTY, window };
    const data = (await res.json()) as Partial<CostsSnapshot>;
    return {
      window,
      total_usd: Number(data.total_usd ?? 0),
      total_requests: Number(data.total_requests ?? 0),
      total_tokens: Number(data.total_tokens ?? 0),
      by_model: Array.isArray(data.by_model) ? data.by_model : [],
      live: true,
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return { ...EMPTY, window };
  }
}
