/**
 * Phase 10.8 — Browser-Use Agent client.
 *
 * Bridge endpoints (server-snippets/browser.routes.ts):
 *   POST /rpc/browser.validate { url }                  → { ok, url, reason? }
 *   POST /rpc/browser.start    { projectId, url, goal } → { sessionId }
 *   POST /rpc/browser.stop     { projectId, sessionId } → { ok }
 *   GET  /rpc/browser.stream?projectId&sessionId        → SSE frames + actions
 */
import { rpc } from "./power-tools-api";

const BRIDGE = (import.meta.env.VITE_HOSTFLOW_BRIDGE_URL as string | undefined) ?? "";

export interface BrowserAction {
  id: string;
  at: number;
  kind: "navigate" | "click" | "type" | "scroll" | "wait" | "extract" | "error";
  detail: string;
  selector?: string | null;
}

export interface BrowserFrame {
  at: number;
  dataUrl: string; // screenshot
  url: string;
}

export interface BrowserSupervision {
  verdict: "watching" | "approved" | "halted";
  note: string | null;
}

export function validateUrlShape(raw: string): { ok: boolean; url: string; reason?: string } {
  const value = raw.trim();
  if (!value) return { ok: false, url: value, reason: "URL required" };
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return { ok: false, url: withScheme, reason: "Invalid host" };
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, url: withScheme, reason: "Malformed URL" };
  }
}

export async function validateUrl(
  url: string,
): Promise<{ ok: boolean; url: string; reason?: string } | null> {
  return rpc(`/rpc/browser.validate`, { method: "POST", body: JSON.stringify({ url }) });
}

export async function startBrowserRun(
  projectId: string,
  url: string,
  goal: string,
): Promise<{ sessionId: string } | null> {
  return rpc(`/rpc/browser.start`, {
    method: "POST",
    body: JSON.stringify({ projectId, url, goal }),
  });
}

export async function stopBrowserRun(
  projectId: string,
  sessionId: string,
): Promise<{ ok: boolean } | null> {
  return rpc(`/rpc/browser.stop`, {
    method: "POST",
    body: JSON.stringify({ projectId, sessionId }),
  });
}

export interface BrowserStreamHandlers {
  onFrame: (f: BrowserFrame) => void;
  onAction: (a: BrowserAction) => void;
  onSupervision: (s: BrowserSupervision) => void;
  onDone: (reason: string) => void;
}

/** SSE stream of screenshots + actions. Returns a closer. */
export function openBrowserStream(
  projectId: string,
  sessionId: string,
  handlers: BrowserStreamHandlers,
): () => void {
  if (!BRIDGE || typeof window === "undefined") return () => {};
  const es = new EventSource(
    `${BRIDGE}/rpc/browser.stream?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`,
  );

  es.addEventListener("frame", (e) => {
    try {
      handlers.onFrame(JSON.parse((e as MessageEvent).data) as BrowserFrame);
    } catch {
      /* noop */
    }
  });
  es.addEventListener("action", (e) => {
    try {
      handlers.onAction(JSON.parse((e as MessageEvent).data) as BrowserAction);
    } catch {
      /* noop */
    }
  });
  es.addEventListener("supervision", (e) => {
    try {
      handlers.onSupervision(JSON.parse((e as MessageEvent).data) as BrowserSupervision);
    } catch {
      /* noop */
    }
  });
  es.addEventListener("done", (e) => {
    let reason = "finished";
    try {
      reason = (JSON.parse((e as MessageEvent).data) as { reason?: string }).reason ?? reason;
    } catch {
      /* noop */
    }
    es.close();
    handlers.onDone(reason);
  });
  es.onerror = () => {
    es.close();
    handlers.onDone("stream closed");
  };

  return () => es.close();
}

export function actionTone(kind: BrowserAction["kind"]): string {
  switch (kind) {
    case "click":
      return "text-[#ff7480]";
    case "type":
      return "text-sky-300";
    case "scroll":
      return "text-amber-300";
    case "navigate":
      return "text-[#c084fc]";
    case "error":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}
