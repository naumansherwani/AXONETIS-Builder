/**
 * Phase 3.9.4 — Power Tools client (frontend).
 * Endpoints Hetzner pe: /rpc/sql.validate · /rpc/caddy.* · /rpc/timetravel.checkout · /rpc/rrweb.push|list
 * Server pending → all helpers return null gracefully.
 */
const BRIDGE = import.meta.env.VITE_HOSTFLOW_BRIDGE_URL ?? "";

export async function rpc<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!BRIDGE) return null;
  try {
    const r = await fetch(`${BRIDGE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// ─── Sherlock SQL validation ───────────────────────────────────────────────
export type SqlValidation = {
  ok: boolean;
  verdict: "safe" | "warn" | "block";
  issues: { level: "info" | "warn" | "error"; message: string }[];
  affectedTables: string[];
  estimatedRows: number | null;
};

export async function validateSql(query: string, projectId: string): Promise<SqlValidation | null> {
  return rpc<SqlValidation>(`/rpc/sql.validate`, {
    method: "POST",
    body: JSON.stringify({ query, projectId }),
  });
}

// ─── Caddy custom domain auto-deploy ───────────────────────────────────────
export type CaddyDomain = {
  id: string;
  domain: string;
  target: string; // upstream URL
  ssl: "pending" | "issuing" | "active" | "failed";
  attachedAt: string;
  lastCheck: string | null;
};

export async function listCaddyDomains(projectId: string): Promise<CaddyDomain[] | null> {
  return rpc<CaddyDomain[]>(`/rpc/caddy.list?projectId=${encodeURIComponent(projectId)}`);
}

export async function attachCaddyDomain(
  projectId: string,
  domain: string,
): Promise<{ ok: boolean; domain?: CaddyDomain; error?: string } | null> {
  return rpc(`/rpc/caddy.attach`, {
    method: "POST",
    body: JSON.stringify({ projectId, domain }),
  });
}

export async function revokeCaddyDomain(id: string): Promise<{ ok: boolean } | null> {
  return rpc(`/rpc/caddy.revoke`, {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

// ─── Git time-travel ───────────────────────────────────────────────────────
export type GitCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

export async function listGitCommits(projectId: string, limit = 50): Promise<GitCommit[] | null> {
  return rpc<GitCommit[]>(
    `/rpc/timetravel.commits?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
  );
}

export async function checkoutIntoPreview(
  projectId: string,
  sha: string,
): Promise<{ ok: boolean; previewUrl?: string; error?: string } | null> {
  return rpc(`/rpc/timetravel.checkout`, {
    method: "POST",
    body: JSON.stringify({ projectId, sha }),
  });
}

// ─── rrweb session replay ──────────────────────────────────────────────────
export type SessionMeta = {
  id: string;
  startedAt: string;
  durationMs: number;
  events: number;
};

export async function pushRrwebBatch(
  projectId: string,
  sessionId: string,
  events: unknown[],
): Promise<{ ok: boolean } | null> {
  return rpc(`/rpc/rrweb.push`, {
    method: "POST",
    body: JSON.stringify({ projectId, sessionId, events }),
  });
}

export async function listSessions(projectId: string): Promise<SessionMeta[] | null> {
  return rpc<SessionMeta[]>(`/rpc/rrweb.list?projectId=${encodeURIComponent(projectId)}`);
}
