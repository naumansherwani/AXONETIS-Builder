/**
 * Rail item registry — single source of truth for left + right side rails.
 * LEFT rail = project navigation. RIGHT rail = workspace (Files · DB · Agents · Logs · Deploy).
 */
import {
  Activity,
  BookOpen,
  Boxes,
  Brain,
  Code2,
  Coins,
  Compass,
  Camera,
  FlaskConical,
  Globe,
  Image as ImageIcon,
  MousePointer2,
  TestTube2,
  Zap,
  Database,
  FileCode2,
  FileText,
  Files,
  Folder,
  GitBranch,
  History,
  KanbanSquare,
  CalendarClock,
  Key,
  Layers,
  LifeBuoy,
  LineChart,
  Rocket,
  MonitorPlay,
  ScrollText,
  Shield,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";

import type { BottomTabId } from "@/lib/builder-state";
import type { RailItem } from "./SideRail";

export interface RailItemFull extends RailItem {
  side: "left" | "right";
}

export const LEFT_RAIL_ITEMS: RailItem[] = [
  {
    id: "projects",
    label: "Projects",
    icon: Code2,
    hint: "Switch between HostFlow, ANEXVOT AI PAY, AXONETIS.",
  },
  { id: "code", label: "Code", icon: FileCode2, hint: "Editor with AI inline suggestions." },
  {
    id: "blueprints",
    label: "Blueprints",
    icon: Layers,
    hint: "Locked architecture docs per project.",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: BookOpen,
    hint: "RAG corpus indexed for the agents.",
  },
  { id: "memory", label: "Memory", icon: Brain, hint: "Agent long-term memory + project context." },
  {
    id: "documents",
    label: "Documents",
    icon: FileText,
    hint: "Specs, blueprints, founder notes.",
  },
  {
    id: "versions",
    label: "Versions",
    icon: History,
    hint: "Time-travel — restore any past commit.",
  },
  { id: "git", label: "Git", icon: GitBranch, hint: "Diff preview, staged changes, history." },
  { id: "github", label: "GitHub", icon: GitBranch, hint: "Repo sync, PRs, issues, release flow." },
  { id: "terminal", label: "Terminal", icon: Terminal, hint: "Server shell into Hetzner brain." },
];

export const RIGHT_RAIL_ITEMS: RailItem[] = [
  {
    id: "command",
    label: "Command",
    icon: Compass,
    hint: "Founder Command Center — all projects, pipeline, agents, cost.",
  },
  { id: "files", label: "Files", icon: Files, hint: "Project file tree." },

  { id: "database", label: "Database", icon: Database, hint: "Tables, RLS, live query runner." },
  {
    id: "agents",
    label: "Agents",
    icon: Users,
    hint: "Jimmy, Sherlock, 8 advisors — live status.",
  },
  {
    id: "dualbrain",
    label: "Dual-Brain",
    icon: ShieldCheck,
    hint: "Jimmy plan → code → Sherlock verify → founder approve.",
  },
  { id: "activity", label: "Activity", icon: Activity, hint: "Live agent activity feed (SSE)." },
  { id: "logs", label: "Logs", icon: ScrollText, hint: "Streaming build + runtime logs." },
  { id: "deploy", label: "Deploy", icon: Rocket, hint: "Sandbox → Staging → Production pipeline." },
  {
    id: "runtime",
    label: "Runtime",
    icon: Boxes,
    hint: "Sandbox HMR + postMessage bridge health.",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: LineChart,
    hint: "Cost meter, token burn, agent performance.",
  },
  {
    id: "storage",
    label: "Storage",
    icon: Folder,
    hint: "Asset CDN, signed URLs, bucket policies.",
  },
  { id: "costs", label: "Costs", icon: Coins, hint: "Real-time token burn + $ cost per model." },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    hint: "Sherlock scan: GDPR, RLS, secret leaks, findings.",
  },
  {
    id: "secrets",
    label: "Secrets",
    icon: Key,
    hint: "Encrypted vault — masked keys, rotate in place.",
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    hint: "Tool Registry — what Jimmy & Sherlock can call.",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    icon: KanbanSquare,
    hint: "Outreach Engine — Scraped → Closed kanban + live ARR.",
  },
  {
    id: "standup",
    label: "Standup",
    icon: CalendarClock,
    hint: "Jimmy's daily outreach standup + GDPR/spam compliance badge.",
  },
  {
    id: "settings",
    label: "Settings",
    icon: SettingsIcon,
    hint: "Model per agent, memory limit, cost thresholds, notifications, theme.",
  },
  {
    id: "replay",
    label: "Replay",
    icon: MonitorPlay,
    hint: "Session replay + Sherlock root-cause analyzer.",
  },
  {
    id: "help",
    label: "Help",
    icon: LifeBuoy,
    hint: "Help Center — fuzzy search, articles, videos, ask Jimmy.",
  },
  {
    id: "vision",
    label: "Vision",
    icon: ImageIcon,
    hint: "Screenshot vision — drop a shot, element map + one-click fixes.",
  },
  {
    id: "presence",
    label: "Presence",
    icon: MousePointer2,
    hint: "Multiplayer — live cursors, selections, activity feed.",
  },
  {
    id: "tests",
    label: "Tests",
    icon: TestTube2,
    hint: "AI test generator — coverage ring, red→green timeline.",
  },
  {
    id: "browser",
    label: "Browser",
    icon: Globe,
    hint: "Browser-use agent — screenshot stream, action log, emergency stop.",
  },
  {
    id: "oneprompt",
    label: "One-Prompt",
    icon: Zap,
    hint: "One-prompt full-stack — Hermes task list, 5 parallel workers, deploy timer.",
  },
  {
    id: "migration",
    label: "Migration",
    icon: FlaskConical,
    hint: "Auto-migration runner — dry-run, diff, apply with backup, rollback.",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: Sparkles,
    hint: "Install specialist agents — SEO Scout, Outreach Hawk, Data Bee.",
  },
];

export const ALL_RAIL_ITEMS: RailItemFull[] = [
  ...LEFT_RAIL_ITEMS.map((i) => ({ ...i, side: "left" as const })),
  ...RIGHT_RAIL_ITEMS.map((i) => ({ ...i, side: "right" as const })),
];
