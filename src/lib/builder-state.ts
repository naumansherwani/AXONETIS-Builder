/**
 * Builder global UI state — Zustand-free minimal store using React context.
 * Holds: selected project, branch, environment, active bottom tab,
 * preview mode (single | triptych), command palette open state.
 */
import { createContext, useContext } from "react";
import type { Branch, Environment, ProjectId } from "./projects";
import type { BridgeStatus, PreviewBridgeEvent } from "./preview-bridge";
import type { PreviewEnv, PreviewFileChange } from "./preview-engine";

export type AgentState = "standby" | "jimmy" | "sherlock";



export type BottomTabId =
  | "command"
  | "files"
  | "code"
  | "database"
  | "agents"
  | "runtime"
  | "git"
  | "github"
  | "logs"
  | "activity"
  | "deploy"
  | "analytics"
  | "documents"
  | "storage"
  | "versions"
  | "terminal"
  | "memory"
  | "blueprints"
  | "knowledge"
  | "projects"
  | "dualbrain";

export type PreviewMode = "single" | "triptych";

export interface BuilderState {
  project: ProjectId;
  branch: Branch;
  environment: Environment;
  bottomTab: BottomTabId | null;
  previewMode: PreviewMode;
  paletteOpen: boolean;
  agentState: AgentState;
  bridgeStatus: BridgeStatus;
  lastBridgeEvent: PreviewBridgeEvent | null;
  previewEnv: PreviewEnv;
  lastPreviewChange: PreviewFileChange | null;
  setPreviewEnv: (e: PreviewEnv) => void;
  setLastPreviewChange: (c: PreviewFileChange | null) => void;
  setProject: (p: ProjectId) => void;
  setBranch: (b: Branch) => void;
  setEnvironment: (e: Environment) => void;
  setBottomTab: (t: BottomTabId | null) => void;
  setPreviewMode: (m: PreviewMode) => void;
  setPaletteOpen: (o: boolean) => void;
  setAgentState: (s: AgentState) => void;
  setBridgeStatus: (s: BridgeStatus) => void;
  setLastBridgeEvent: (e: PreviewBridgeEvent | null) => void;
}


export const BuilderCtx = createContext<BuilderState | null>(null);

export function useBuilder(): BuilderState {
  const ctx = useContext(BuilderCtx);
  if (!ctx) throw new Error("useBuilder must be used inside <BuilderProvider>");
  return ctx;
}
