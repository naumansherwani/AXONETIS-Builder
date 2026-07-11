/**
 * Security API — reads Sherlock scan snapshot from Hetzner NEXATECT-Engine.
 * Endpoint: GET /api/agents/founder/security
 * Graceful offline fallback.
 */
const BASE = (import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface SecurityFinding {
  id: string;
  severity: Severity;
  title: string;
  path?: string;
  detected_at: string;
}

export interface SecuritySnapshot {
  last_scan_at: string | null;
  gdpr_ok: boolean;
  rls_ok: boolean;
  secrets_leaked: number;
  findings: SecurityFinding[];
  score: number;
  live: boolean;
}

const EMPTY: SecuritySnapshot = {
  last_scan_at: null,
  gdpr_ok: false,
  rls_ok: false,
  secrets_leaked: 0,
  findings: [],
  score: 0,
  live: false,
};

export async function fetchSecurity(): Promise<SecuritySnapshot> {
  try {
    const res = await fetch(`${BASE}/api/agents/founder/security`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as Partial<SecuritySnapshot>;
    return {
      last_scan_at: data.last_scan_at ?? null,
      gdpr_ok: Boolean(data.gdpr_ok),
      rls_ok: Boolean(data.rls_ok),
      secrets_leaked: Number(data.secrets_leaked ?? 0),
      findings: Array.isArray(data.findings) ? data.findings : [],
      score: Number(data.score ?? 0),
      live: true,
    };
  } catch {
    return EMPTY;
  }
}

export async function triggerSherlockScan(): Promise<{ ok: boolean; scan_id?: string }> {
  try {
    const res = await fetch(`${BASE}/api/agents/founder/security/scan`, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { scan_id?: string };
    return { ok: true, scan_id: data.scan_id };
  } catch {
    return { ok: false };
  }
}
