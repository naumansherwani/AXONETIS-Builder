import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen, Boxes, Brain, Code2, Database, FileCode2, FileText, Files,
  Folder, GitBranch, Github, History, Layers, LineChart, Rocket, ScrollText,
  Terminal, Users, X,
} from "lucide-react";
import { useState } from "react";
import { useBuilder, type BottomTabId } from "@/lib/builder-state";

const TABS: { id: BottomTabId; label: string; icon: typeof Files }[] = [
  { id: "files",      label: "Files",      icon: Files },
  { id: "code",       label: "Code",       icon: FileCode2 },
  { id: "database",   label: "Database",   icon: Database },
  { id: "agents",     label: "Agents",     icon: Users },
  { id: "runtime",    label: "Runtime",    icon: Boxes },
  { id: "git",        label: "Git",        icon: GitBranch },
  { id: "github",     label: "GitHub",     icon: Github },
  { id: "logs",       label: "Logs",       icon: ScrollText },
  { id: "deploy",     label: "Deploy",     icon: Rocket },
  { id: "analytics",  label: "Analytics",  icon: LineChart },
  { id: "documents",  label: "Documents",  icon: FileText },
  { id: "storage",    label: "Storage",    icon: Folder },
  { id: "versions",   label: "Versions",   icon: History },
  { id: "terminal",   label: "Terminal",   icon: Terminal },
  { id: "memory",     label: "Memory",     icon: Brain },
  { id: "blueprints", label: "Blueprints", icon: Layers },
  { id: "knowledge",  label: "Knowledge",  icon: BookOpen },
  { id: "projects",   label: "Projects",   icon: Code2 },
];

export default function BottomTabs() {
  const { bottomTab, setBottomTab } = useBuilder();
  const [hover, setHover] = useState<BottomTabId | null>(null);

  return (
    <>
      <AnimatePresence>
        {bottomTab && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 280, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            className="shrink-0 overflow-hidden border-t border-white/[0.06] bg-background/95 backdrop-blur-xl"
          >
            <TabPanel id={bottomTab} onClose={() => setBottomTab(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fb-no-scrollbar relative flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-t border-white/[0.06] bg-background/80 px-2 backdrop-blur-xl">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = bottomTab === t.id;
          return (
            <div
              key={t.id}
              className="relative"
              onMouseEnter={() => setHover(t.id)}
              onMouseLeave={() => setHover((h) => (h === t.id ? null : h))}
            >
              <button
                onClick={() => setBottomTab(active ? null : t.id)}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors ${
                  active
                    ? "bg-[#E50914]/15 text-[#ff6b73]"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>

              {/* Quick-peek hover preview */}
              <AnimatePresence>
                {hover === t.id && !active && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.15 }}
                    className="fb-glass pointer-events-none absolute bottom-9 left-1/2 z-50 w-56 -translate-x-1/2 rounded-lg p-3 shadow-2xl"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-[#ff6b73]" />
                      <span className="text-xs font-semibold">{t.label}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {peekHint(t.id)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
}

function TabPanel({ id, onClose }: { id: BottomTabId; onClose: () => void }) {
  const meta = TABS.find((t) => t.id === id)!;
  const Icon = meta.icon;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Icon className="h-3.5 w-3.5 text-[#ff6b73]" />
          {meta.label}
        </div>
        <button onClick={onClose} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid flex-1 place-items-center text-center text-xs text-muted-foreground">
        <div>
          <div className="mb-1 font-medium text-foreground">{meta.label} panel</div>
          <div>Phase 2 wires this surface to live data. Visual foundation ready.</div>
        </div>
      </div>
    </div>
  );
}

function peekHint(id: BottomTabId): string {
  const map: Record<BottomTabId, string> = {
    files: "Project file tree. Click any file to open in Code.",
    code: "Monaco editor with multi-cursor, AI inline suggestions.",
    database: "Tables, rows, RLS policies, live query runner.",
    agents: "Jimmy, Sherlock, 8 advisors — live status & queue.",
    runtime: "Sandbox HMR state, postMessage bridge health.",
    git: "Diff preview, staged changes, commit history.",
    github: "Repo sync, PRs, issues, release flow.",
    logs: "Streaming build + runtime logs with filters.",
    deploy: "Sandbox → Staging → Production pipeline.",
    analytics: "Cost meter, token burn, agent performance.",
    documents: "Specs, blueprints, founder notes.",
    storage: "Asset CDN, signed URLs, bucket policies.",
    versions: "Time-travel — restore any past commit.",
    terminal: "Server shell into Hetzner brain.",
    memory: "Agent long-term memory + project context.",
    blueprints: "Locked architecture docs per project.",
    knowledge: "RAG corpus indexed for the agents.",
    projects: "Switch between HostFlow, Rapid Pay, Builder.",
  };
  return map[id];
}
