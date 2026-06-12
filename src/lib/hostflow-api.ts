/**
 * Frontend-only client for existing HostFlow server APIs.
 * AXONETIS does not execute AI/backend logic in this repo.
 */
import type { ProjectId } from "./projects";

const HOSTFLOW_API_BASE = import.meta.env.VITE_HOSTFLOW_SERVER_URL as string | undefined;

export interface HostFlowBridgeCommand {
  projectId: ProjectId;
  prompt: string;
  branch: string;
  environment: string;
}

export async function callHostFlowServer<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  if (!HOSTFLOW_API_BASE) {
    throw new Error("HostFlow server URL is not configured for this frontend.");
  }

  const response = await fetch(`${HOSTFLOW_API_BASE.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HostFlow server request failed: ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export function sendBuilderCommand(command: HostFlowBridgeCommand) {
  return callHostFlowServer<{ taskId: string; status: string }>("/api/axon/commands", {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function getBridgeHealth(projectId: ProjectId) {
  return callHostFlowServer<{ status: string; checkedAt: string }>(`/api/axon/bridge/health?projectId=${projectId}`);
}