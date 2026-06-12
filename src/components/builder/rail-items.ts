/**
 * Rail item registry — single source of truth for left + right side rails.
 * LEFT rail = project navigation. RIGHT rail = workspace (Files · DB · Agents · Logs · Deploy).
 */
import {
  Activity, BookOpen, Boxes, Brain, Code2, Database, FileCode2, FileText, Files,
  Folder, GitBranch, Github, History, Layers, LineChart, Rocket, ScrollText,
  Terminal, Users,
} from "lucide-react";
import type { BottomTabId } from "@/lib/builder-state";
import type { RailItem } from "./SideRail";

export interface RailItemFull extends RailItem {
  side: "left" | "right";
}

export const LEFT_RAIL_ITEMS: RailItem[] = [
  { id: "projects",   label: "Projects",   icon: Code2,      hint: "Switch between HostFlow, Rapid Pay, AXONETIS." },
  { id: "code",       label: "Code",       icon: FileCode2,  hint: "Editor with AI inline suggestions." },
  { id: "blueprints", label: "Blueprints", icon: Layers,     hint: "Locked architecture docs per project." },
  { id: "knowledge",  label: "Knowledge",  icon: BookOpen,   hint: "RAG corpus indexed for the agents." },
  { id: "memory",     label: "Memory",     icon: Brain,      hint: "Agent long-term memory + project context." },
  { id: "documents",  label: "Documents",  icon: FileText,   hint: "Specs, blueprints, founder notes." },
  { id: "versions",   label: "Versions",   icon: History,    hint: "Time-travel — restore any past commit." },
  { id: "git",        label: "Git",        icon: GitBranch,  hint: "Diff preview, staged changes, history." },
  { id: "github",     label: "GitHub",     icon: Github,     hint: "Repo sync, PRs, issues, release flow." },
  { id: "terminal",   label: "Terminal",   icon: Terminal,   hint: "Server shell into Hetzner brain." },
];

export const RIGHT_RAIL_ITEMS: RailItem[] = [
  { id: "files",      label: "Files",      icon: Files,      hint: "Project file tree." },
  { id: "database",   label: "Database",   icon: Database,   hint: "Tables, RLS, live query runner." },
  { id: "agents",     label: "Agents",     icon: Users,      hint: "Jimmy, Sherlock, 8 advisors — live status." },
  { id: "activity",   label: "Activity",   icon: Activity,   hint: "Live agent activity feed (SSE)." },
  { id: "logs",       label: "Logs",       icon: ScrollText, hint: "Streaming build + runtime logs." },
  { id: "deploy",     label: "Deploy",     icon: Rocket,     hint: "Sandbox → Staging → Production pipeline." },
  { id: "runtime",    label: "Runtime",    icon: Boxes,      hint: "Sandbox HMR + postMessage bridge health." },
  { id: "analytics",  label: "Analytics",  icon: LineChart,  hint: "Cost meter, token burn, agent performance." },
  { id: "storage",    label: "Storage",    icon: Folder,     hint: "Asset CDN, signed URLs, bucket policies." },
];

export const ALL_RAIL_ITEMS: RailItemFull[] = [
  ...LEFT_RAIL_ITEMS.map((i) => ({ ...i, side: "left" as const })),
  ...RIGHT_RAIL_ITEMS.map((i) => ({ ...i, side: "right" as const })),
];
