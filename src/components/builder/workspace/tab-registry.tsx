/**
 * Phase A1 — Workspace tab registry.
 * Single source of truth mapping tab kind → label, icon, and renderer.
 * NO duplicate panels: re-uses existing panel components.
 */
import {
  Monitor, ScrollText, Database, GitBranch, Terminal as TerminalIcon, Boxes,
  Files as FilesIcon, Compass, type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import LivePreview from "../LivePreview";
import LogsPanel from "../panels/LogsPanel";
import DatabasePanel from "../panels/DatabasePanel";
import RuntimePanel from "../panels/RuntimePanel";
import FilesPanel from "../panels/FilesPanel";
import CommandCenterPanel from "../panels/CommandCenterPanel";
import TerminalPanel from "./TerminalPanel";
import GitHubPanel from "./GitHubPanel";

export type TabKind =
  | "preview" | "logs" | "database" | "runtime"
  | "terminal" | "github" | "files" | "command";

export interface TabDef {
  kind: TabKind;
  label: string;
  icon: LucideIcon;
  render: ComponentType;
  closable: boolean;
}

export const TAB_REGISTRY: Record<TabKind, TabDef> = {
  preview:  { kind: "preview",  label: "Preview",  icon: Monitor,      render: LivePreview,         closable: false },
  logs:     { kind: "logs",     label: "Logs",     icon: ScrollText,   render: LogsPanel,           closable: true  },
  database: { kind: "database", label: "Database", icon: Database,     render: DatabasePanel,       closable: true  },
  runtime:  { kind: "runtime",  label: "Runtime",  icon: Boxes,        render: RuntimePanel,        closable: true  },
  files:    { kind: "files",    label: "Files",    icon: FilesIcon,    render: FilesPanel,          closable: true  },
  command:  { kind: "command",  label: "Command",  icon: Compass,      render: CommandCenterPanel,  closable: true  },
  terminal: { kind: "terminal", label: "Terminal", icon: TerminalIcon, render: TerminalPanel,       closable: true  },
  github:   { kind: "github",   label: "GitHub",   icon: GitBranch,    render: GitHubPanel,         closable: true  },
};

export const TAB_KINDS = Object.keys(TAB_REGISTRY) as TabKind[];
