/**
 * Phase 10.1 + 10.2 — Session Replay + Sherlock Replay Analyzer client.
 *
 * Bridge endpoints (Hetzner, server-snippets/replay.routes.ts):
 *   GET  /rpc/rrweb.list      (already used by power-tools-api.listSessions)
 *   GET  /rpc/rrweb.events?projectId&sessionId   → { events }
 *   POST /rpc/replay.analyze  { projectId, sessionId } → ReplayAnalysis
 *   POST /rpc/replay.applyfix { projectId, sessionId, analysisId } → { ok, diff_id }
 *
 * NO DUPLICATE: session listing stays in power-tools-api (listSessions);
 * the shared bridge `rpc()` helper is reused from there.
 */
import { rpc } from "./power-tools-api";

export type ReplayEvent = {
  type: number;
  timestamp: number;
  data?: Record<string, unknown>;
};

/** rrweb console/network plugin rows extracted from the raw event stream. */
export type ReplayConsoleRow = {
  at: number; // ms offset from session start
  level: "log" | "info" | "warn" | "error" | "debug";
  text: string;
};

export type ReplayNetworkRow = {
  at: number;
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
};

export type ReplayAnalysis = {
  id: string;
  sessionId: string;
  rootCause: string;
  summary: string;
  suggestedFix: { path: string; language: string; snippet: string } | null;
  confidence: number; // 0..100
  createdAt: string;
};

export async function fetchSessionEvents(
  projectId: string,
  sessionId: string,
): Promise<ReplayEvent[] | null> {
  const res = await rpc<{ events?: ReplayEvent[] } | ReplayEvent[]>(
    `/rpc/rrweb.events?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`,
  );
  if (!res) return null;
  const events = Array.isArray(res) ? res : (res.events ?? []);
  return events.slice().sort((a, b) => a.timestamp - b.timestamp);
}

export async function analyzeSession(
  projectId: string,
  sessionId: string,
): Promise<ReplayAnalysis | null> {
  return rpc<ReplayAnalysis>(`/rpc/replay.analyze`, {
    method: "POST",
    body: JSON.stringify({ projectId, sessionId }),
  });
}

export async function applyReplayFix(
  projectId: string,
  sessionId: string,
  analysisId: string,
): Promise<{ ok: boolean; diff_id?: string; error?: string } | null> {
  return rpc(`/rpc/replay.applyfix`, {
    method: "POST",
    body: JSON.stringify({ projectId, sessionId, analysisId }),
  });
}

/** Split rrweb plugin events into console + network overlays and error markers. */
export function extractOverlays(events: ReplayEvent[]): {
  console: ReplayConsoleRow[];
  network: ReplayNetworkRow[];
  errors: number[]; // ms offsets
} {
  const start = events[0]?.timestamp ?? 0;
  const consoleRows: ReplayConsoleRow[] = [];
  const networkRows: ReplayNetworkRow[] = [];

  for (const ev of events) {
    if (ev.type !== 6 || !ev.data) continue;
    const plugin = String(ev.data["plugin"] ?? "");
    const payload = (ev.data["payload"] ?? {}) as Record<string, unknown>;
    const at = Math.max(0, ev.timestamp - start);

    if (plugin.includes("console")) {
      const level = String(payload["level"] ?? "log") as ReplayConsoleRow["level"];
      const args = Array.isArray(payload["payload"]) ? (payload["payload"] as unknown[]) : [];
      consoleRows.push({
        at,
        level: (["log", "info", "warn", "error", "debug"] as const).includes(level) ? level : "log",
        text: args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
      });
    } else if (plugin.includes("network")) {
      const requests = Array.isArray(payload["requests"])
        ? (payload["requests"] as Record<string, unknown>[])
        : [payload];
      for (const r of requests) {
        networkRows.push({
          at,
          method: String(r["method"] ?? "GET").toUpperCase(),
          url: String(r["url"] ?? r["name"] ?? ""),
          status: typeof r["status"] === "number" ? (r["status"] as number) : null,
          durationMs:
            typeof r["duration"] === "number"
              ? Math.round(r["duration"] as number)
              : typeof r["responseEnd"] === "number" && typeof r["startTime"] === "number"
                ? Math.round((r["responseEnd"] as number) - (r["startTime"] as number))
                : null,
        });
      }
    }
  }

  const errors = [
    ...consoleRows.filter((c) => c.level === "error").map((c) => c.at),
    ...networkRows.filter((n) => (n.status ?? 0) >= 400).map((n) => n.at),
  ].sort((a, b) => a - b);

  return { console: consoleRows, network: networkRows, errors };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
