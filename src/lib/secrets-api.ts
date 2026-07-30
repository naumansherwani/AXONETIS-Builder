/**
 * Secrets API — Hetzner brain: list masked secrets, rotate, add.
 * Endpoints:
 *   GET  /api/agents/founder/secrets            → { secrets: SecretRow[] }
 *   POST /api/agents/founder/secrets            → { name, value }   (add/update)
 *   POST /api/agents/founder/secrets/rotate     → { name }
 * Values are never returned in full — only a masked preview (last 4).
 */
const BASE =
  (import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export interface SecretRow {
  name: string;
  maskedPreview: string; // e.g. "••••••••ab12"
  scope: "runtime" | "build" | "provider";
  updatedAt?: string;
  used_by?: string[];
}

export interface SecretsSnapshot {
  live: boolean;
  secrets: SecretRow[];
  fetchedAt: string;
}

export async function fetchSecrets(): Promise<SecretsSnapshot> {
  const fetchedAt = new Date().toISOString();
  if (!BASE) return { live: false, secrets: [], fetchedAt };
  try {
    const res = await fetch(`${BASE}/api/agents/founder/secrets`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { live: false, secrets: [], fetchedAt };
    const j = await res.json();
    return { live: true, secrets: Array.isArray(j.secrets) ? j.secrets : [], fetchedAt };
  } catch {
    return { live: false, secrets: [], fetchedAt };
  }
}

export async function rotateSecret(name: string): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: "Server offline" };
  try {
    const res = await fetch(`${BASE}/api/agents/founder/secrets/rotate`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
