/**
 * Builder global UI state — Zustand-free minimal store using React context.
 * Holds: selected project, branch, environment, active bottom tab,
 * preview mode (single | triptych), command palette open state.
 */
import { createContext, useContext } from "react";
import type { Branch, Environment, ProjectId } from "./projects";

export type BottomTabId =
  | "files"
  | "code"
  | "database"
  | "agents"
  | "runtime"
  | "git"
  | "github"
  | "logs"
  | "deploy"
  | "analytics"
  | "documents"
  | "storage"
  | "versions"
  | "terminal"
  | "memory"
  | "blueprints"
  | "knowledge"
  | "projects";

export type PreviewMode = "single" | "triptych";

export interface BuilderState {
  project: ProjectId;
  branch: Branch;
  environment: Environment;
  bottomTab: BottomTabId | null;
  previewMode: PreviewMode;
  paletteOpen: boolean;
  setProject: (p: ProjectId) => void;
  setBranch: (b: Branch) => void;
  setEnvironment: (e: Environment) => void;
  setBottomTab: (t: BottomTabId | null) => void;
  setPreviewMode: (m: PreviewMode) => void;
  setPaletteOpen: (o: boolean) => void;
}

export const BuilderCtx = createContext<BuilderState | null>(null);

export function useBuilder(): BuilderState {
  const ctx = useContext(BuilderCtx);
  if (!ctx) throw new Error("useBuilder must be used inside <BuilderProvider>");
  return ctx;
}
