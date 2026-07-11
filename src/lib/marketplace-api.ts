/**
 * Phase 3.9.6 — Agent Marketplace client (frontend).
 * Endpoints Hetzner pe:
 *   GET  /rpc/marketplace.list           → curated + community agents
 *   GET  /rpc/marketplace.installed      → what the founder has installed on this project
 *   POST /rpc/marketplace.install        → install agent into current project
 *   POST /rpc/marketplace.uninstall      → remove installed agent
 *
 * Server pending → helpers return null / [] gracefully (constitutional principle).
 * NO DUPLICATE: matches existing power-tools-api.ts rpc<T>() shape.
 */
const BRIDGE = (import.meta.env.VITE_HOSTFLOW_BRIDGE_URL as string | undefined) ?? "";

async function rpc<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!BRIDGE) return null;
  try {
    const r = await fetch(`${BRIDGE}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      ...init,
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export type MarketplaceCategory = "build" | "review" | "ops" | "data" | "creative" | "outreach";

export interface MarketplaceAgent {
  slug: string;                  // e.g. "seo-scout"
  name: string;                  // display name
  tagline: string;               // one-line
  description: string;           // long
  category: MarketplaceCategory;
  author: string;                // "NEXATECT" | community handle
  version: string;               // semver
  icon?: string | null;          // emoji or url
  price_usd: number;             // 0 = free
  installs: number;
  rating: number;                // 0..5
  tools: string[];               // tool registry ids it uses
  featured?: boolean;
  official?: boolean;
}

export interface InstalledAgent {
  slug: string;
  version: string;
  installed_at: string;
  enabled: boolean;
}

export async function listMarketplace(): Promise<MarketplaceAgent[]> {
  const data = await rpc<{ agents: MarketplaceAgent[] }>("/rpc/marketplace.list");
  return Array.isArray(data?.agents) ? data!.agents : [];
}

export async function listInstalled(projectId: string): Promise<InstalledAgent[]> {
  const data = await rpc<{ installed: InstalledAgent[] }>(
    `/rpc/marketplace.installed?projectId=${encodeURIComponent(projectId)}`,
  );
  return Array.isArray(data?.installed) ? data!.installed : [];
}

export async function installAgent(projectId: string, slug: string): Promise<{ ok: boolean } | null> {
  return rpc<{ ok: boolean }>("/rpc/marketplace.install", {
    method: "POST",
    body: JSON.stringify({ projectId, slug }),
  });
}

export async function uninstallAgent(projectId: string, slug: string): Promise<{ ok: boolean } | null> {
  return rpc<{ ok: boolean }>("/rpc/marketplace.uninstall", {
    method: "POST",
    body: JSON.stringify({ projectId, slug }),
  });
}
