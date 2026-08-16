/**
 * Phase 3.9.3 — Publish/Visibility client (frontend).
 * Talks to Hetzner bridge /rpc/publish.* + /rpc/deploys.status (SSE).
 * Failures stay explicit: deploy actions never pretend to succeed offline.
 */
const BRIDGE = (
  (import.meta.env.VITE_HOSTFLOW_BRIDGE_URL as string | undefined) ??
  (import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined) ??
  ""
).replace(/\/$/, "");

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

export async function createShareLink(projectId: string, ttlDays = 7): Promise<ShareLink | null> {
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
    try {
      es?.close();
    } catch {
      /* ignore */
    }
  };
}

/* ───────────────────────────────────────────────────────────────────────────
 * REAL DEPLOY PIPELINE — POST /rpc/publish.run (SSE over fetch)
 * Server: server-snippets/deploy.routes.ts
 * Steps: promote → git pull → bun install → bun run build → migrations →
 *        pm2 reload → health probe.
 * ─────────────────────────────────────────────────────────────────────────── */

export type DeployStepId =
  | "promote"
  | "git"
  | "install"
  | "build"
  | "migrate"
  | "reload"
  | "health";

export type DeployStepEvent = {
  id: DeployStepId;
  status: "running" | "ok" | "error";
  label: string;
  at: number;
};

export interface RunPublishHandlers {
  onStart?: (info: { runId: string; repo: string; pm2: string; url: string }) => void;
  onStep?: (step: DeployStepEvent) => void;
  onLog?: (line: string) => void;
  onDone?: (info: { runId: string; ok: boolean; url: string }) => void;
  onError?: (message: string) => void;
}

export function isDeployPipelineAvailable() {
  return Boolean(BRIDGE);
}

export async function runPublish(
  projectId: string,
  branch: string,
  handlers: RunPublishHandlers,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  if (!BRIDGE) {
    handlers.onError?.("Bridge URL configured nahi hai — deploy pipeline reachable nahi.");
    return;
  }
  const res = await fetch(`${BRIDGE}/rpc/publish.run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ projectId, branch }),
    signal: opts?.signal,
  });
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 240);
    throw new Error(
      res.status === 404
        ? "Real deploy route /rpc/publish.run bridge par mounted nahi hai."
        : `publish.run ${res.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (event: string, raw: string) => {
    let data: unknown = null;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const d = (data ?? {}) as Record<string, unknown>;
    switch (event) {
      case "start":
        handlers.onStart?.({
          runId: String(d.runId ?? ""),
          repo: String(d.repo ?? ""),
          pm2: String(d.pm2 ?? ""),
          url: String(d.url ?? ""),
        });
        break;
      case "step":
        handlers.onStep?.({
          id: d.id as DeployStepId,
          status: (d.status as DeployStepEvent["status"]) ?? "running",
          label: String(d.label ?? ""),
          at: Number(d.at ?? Date.now()),
        });
        break;
      case "log":
        handlers.onLog?.(String(d.line ?? ""));
        break;
      case "done":
        handlers.onDone?.({
          runId: String(d.runId ?? ""),
          ok: Boolean(d.ok),
          url: String(d.url ?? ""),
        });
        break;
      case "error":
        handlers.onError?.(String(d.message ?? "deploy failed"));
        break;
      default:
        break;
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) dispatch(event, dataLines.join("\n"));
    }
  }

  if (buffer.trim()) {
    const dataLines = buffer
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (dataLines.length) dispatch("message", dataLines.join("\n"));
  }
}
