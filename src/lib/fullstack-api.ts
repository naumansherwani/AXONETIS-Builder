/**
 * Phase 10.10 — One-Prompt Full-Stack client (Hermes task planner + parallel workers).
 *
 * Bridge endpoints (server-snippets/fullstack.routes.ts):
 *   POST /rpc/fullstack.begin  { projectId, prompt } → { buildId, tasks }
 *   GET  /rpc/fullstack.stream?projectId&buildId     → SSE (task, worker, deploy, done)
 *   POST /rpc/fullstack.cancel { projectId, buildId } → { ok }
 */
import { rpc } from "./power-tools-api";

const BRIDGE = (import.meta.env.VITE_HOSTFLOW_BRIDGE_URL as string | undefined) ?? "";

export type TaskState = "queued" | "running" | "done" | "failed";

export interface BuildTask {
  id: string;
  index: number;
  title: string;
  state: TaskState;
  worker: number | null; // 1..5
}

export interface WorkerState {
  id: number; // 1..5
  task: string | null;
  progress: number; // 0..100
  busy: boolean;
}

export interface BuildDeploy {
  etaSeconds: number | null;
  url: string | null;
  phase: "planning" | "building" | "deploying" | "live" | "cancelled" | "failed";
}

export interface BuildBegin {
  buildId: string;
  tasks: BuildTask[];
}

export async function beginFullStack(
  projectId: string,
  prompt: string,
): Promise<BuildBegin | null> {
  return rpc<BuildBegin>(`/rpc/fullstack.begin`, {
    method: "POST",
    body: JSON.stringify({ projectId, prompt }),
  });
}

export async function cancelFullStack(
  projectId: string,
  buildId: string,
): Promise<{ ok: boolean } | null> {
  return rpc(`/rpc/fullstack.cancel`, {
    method: "POST",
    body: JSON.stringify({ projectId, buildId }),
  });
}

export interface FullStackHandlers {
  onTask: (t: BuildTask) => void;
  onWorker: (w: WorkerState) => void;
  onDeploy: (d: BuildDeploy) => void;
  onDone: (reason: string) => void;
}

export function openFullStackStream(
  projectId: string,
  buildId: string,
  handlers: FullStackHandlers,
): () => void {
  if (!BRIDGE || typeof window === "undefined") return () => {};
  const es = new EventSource(
    `${BRIDGE}/rpc/fullstack.stream?projectId=${encodeURIComponent(projectId)}&buildId=${encodeURIComponent(buildId)}`,
  );
  const bind = <T>(name: string, cb: (v: T) => void) =>
    es.addEventListener(name, (e) => {
      try {
        cb(JSON.parse((e as MessageEvent).data) as T);
      } catch {
        /* noop */
      }
    });

  bind<BuildTask>("task", handlers.onTask);
  bind<WorkerState>("worker", handlers.onWorker);
  bind<BuildDeploy>("deploy", handlers.onDeploy);
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

export const WORKER_COUNT = 5;

export function emptyWorkers(): WorkerState[] {
  return Array.from({ length: WORKER_COUNT }, (_, i) => ({
    id: i + 1,
    task: null,
    progress: 0,
    busy: false,
  }));
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
