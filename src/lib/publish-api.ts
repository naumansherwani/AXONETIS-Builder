/**
 * Phase 3.9.3 — Publish/Visibility client (frontend).
 * Talks to Hetzner bridge /rpc/publish.* + /rpc/deploys.status (SSE).
 * Server endpoints pending on founder Hetzner — falls back to null/offline
 * per constitutional principle (no dummy data).
 */
const BRIDGE = import.meta.env.VITE_HOSTFLOW_BRIDGE_URL ?? "";

export type Visibility = "public" | "unlisted" | "private";
export type DeployStatus = "up_to_date" | "changes_pending" | "deploying" | "failed" | "offline";

export type PublishState = {
  projectId: string;
  url: string | null;
  customDomain: string | null;
  visibility: Visibility;
  status: DeployStatus;
  visitors24h: number;
  lastPublishedAt: string | null;
};

export type ShareLink = {
  url: string;
  expiresAt: string;
};

async function rpc<T>(path: string, init?: RequestInit): Promise<T | null> {
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

export async function fetchPublishState(projectId: string): Promise<PublishState | null> {
  return rpc<PublishState>(`/rpc/publish.state?projectId=${encodeURIComponent(projectId)}`);
}

export async function setVisibility(
  projectId: string,
  visibility: Visibility,
): Promise<{ ok: boolean } | null> {
  return rpc<{ ok: boolean }>(`/rpc/publish.setVisibility`, {
    method: "POST",
    body: JSON.stringify({ projectId, visibility }),
  });
}

export async function createShareLink(
  projectId: string,
  ttlDays = 7,
): Promise<ShareLink | null> {
  return rpc<ShareLink>(`/rpc/publish.share`, {
    method: "POST",
    body: JSON.stringify({ projectId, ttlDays }),
  });
}

export async function unpublish(projectId: string): Promise<{ ok: boolean } | null> {
  return rpc<{ ok: boolean }>(`/rpc/publish.unpublish`, {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
}

/**
 * SSE stream of deploy status. Returns unsubscribe fn.
 * onEvent fires whenever status/visitors update.
 */
export function subscribeDeployStatus(
  projectId: string,
  onEvent: (state: Partial<PublishState>) => void,
): () => void {
  if (!BRIDGE) return () => {};
  let es: EventSource | null = null;
  try {
    es = new EventSource(`${BRIDGE}/rpc/deploys.status?projectId=${encodeURIComponent(projectId)}`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        onEvent(data);
      } catch {
        // ignore malformed
      }
    };
    es.onerror = () => {
      // silent — server pending
    };
  } catch {
    // ignore
  }
  return () => {
    try { es?.close(); } catch { /* ignore */ }
  };
}
