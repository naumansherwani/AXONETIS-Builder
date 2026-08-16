/**
 * Phase 3.9.7 — Global Router client (frontend).
 * The Global Router picks the cheapest/fastest model that satisfies the prompt's
 * intent tier (Jimmy build vs Sherlock audit vs classification vs deep reasoning).
 *
 * Endpoints Hetzner pe:
 *   POST /rpc/router.preview   { prompt, agent } → { model, default_model, est_cost_usd, est_saved_usd, reason }
 *
 * Server pending → returns null gracefully; UI shows nothing.
 * NO DUPLICATE: cost/token badges already exist on assistant messages —
 * this file only adds the *pre-send* routing preview + savings math.
 */
const BRIDGE = (import.meta.env.VITE_HOSTFLOW_BRIDGE_URL as string | undefined) ?? "";

export interface RouterPreview {
  model: string; // chosen model, e.g. "qwen/qwen-2.5-coder-32b"
  default_model: string; // what would have been used without routing
  est_cost_usd: number; // predicted cost for this prompt
  est_saved_usd: number; // default_cost - chosen_cost
  reason: string; // "cheapest for build-tier" / "fastest for classify" etc.
}

export async function previewRoute(
  prompt: string,
  agent: string,
  signal?: AbortSignal,
): Promise<RouterPreview | null> {
  if (!BRIDGE || !prompt.trim()) return null;
  try {
    const r = await fetch(`${BRIDGE}/rpc/router.preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), agent }),
      signal: signal ?? AbortSignal.timeout(3500),
    });
    if (!r.ok) return null;
    return (await r.json()) as RouterPreview;
  } catch {
    return null;
  }
}

/** Human-readable short model tag, matching UnifiedChat rendering. */
export function shortModelTag(model: string | null | undefined): string | null {
  if (!model) return null;
  return model
    .split("/")
    .slice(-1)[0]
    .replace(/-instruct$|:free$/gi, "");
}

/** Format tiny USD amounts with sensible precision. */
export function formatUsd(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "$0";
  if (v < 0.001) return `$${v.toFixed(5)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
