import { PROJECTS, type ProjectId } from "./projects";

export type BridgeStatus = "standby" | "handshaking" | "connected" | "no-signal";
export type BridgeEventLevel = "info" | "ok" | "warn" | "error";

export interface PreviewBridgeEvent {
  type: string;
  projectId?: ProjectId;
  origin: string;
  receivedAt: number;
  level: BridgeEventLevel;
  summary: string;
  payload?: unknown;
}

const BUILDER_SOURCE = "axonetis-builder";
const PREVIEW_SOURCES = new Set([
  "hostflow-preview",
  "anexvotaipay-preview",
  "axonetis-preview",
  "hostflow-bridge",
]);
const ALLOWED_ORIGINS = new Set(PROJECTS.map((project) => new URL(project.previewUrl).origin));

export function getProjectOrigin(projectId: ProjectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  return project ? new URL(project.previewUrl).origin : "*";
}

export function isAllowedPreviewOrigin(origin: string) {
  return ALLOWED_ORIGINS.has(origin);
}

export function createBridgeHandshake(projectId: ProjectId) {
  return {
    source: BUILDER_SOURCE,
    type: "bridge:handshake",
    version: 1,
    projectId,
    sentAt: Date.now(),
    capabilities: ["route:change", "dom:click", "runtime:error", "hmr:reload"],
  };
}

export function normalizePreviewBridgeEvent(messageEvent: MessageEvent): PreviewBridgeEvent | null {
  if (!isAllowedPreviewOrigin(messageEvent.origin)) return null;
  const data = messageEvent.data;
  if (!data || typeof data !== "object") return null;

  const raw = data as {
    source?: string;
    type?: string;
    projectId?: ProjectId;
    payload?: unknown;
    url?: string;
    message?: string;
  };
  if (!raw.source || !PREVIEW_SOURCES.has(raw.source) || !raw.type) return null;

  const level: BridgeEventLevel = raw.type.includes("error")
    ? "error"
    : raw.type.includes("ready") || raw.type.includes("pong") || raw.type.includes("hmr")
      ? "ok"
      : "info";

  return {
    type: raw.type,
    projectId: raw.projectId,
    origin: messageEvent.origin,
    receivedAt: Date.now(),
    level,
    summary: summarizeBridgeEvent(raw.type, raw.url ?? raw.message),
    payload: raw.payload,
  };
}

function summarizeBridgeEvent(type: string, detail?: string) {
  if (type === "bridge:ready") return "Preview bridge ready";
  if (type === "bridge:pong") return "Preview bridge heartbeat OK";
  if (type === "route:change") return `Preview route changed${detail ? ` → ${detail}` : ""}`;
  if (type === "dom:click") return `Preview click captured${detail ? ` → ${detail}` : ""}`;
  if (type === "runtime:error") return `Preview runtime error${detail ? ` → ${detail}` : ""}`;
  if (type === "hmr:reload") return "Preview HMR reload acknowledged";
  return `Preview event: ${type}`;
}
