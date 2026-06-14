/**
 * SIDE PANEL DRAWER — opens when any rail icon is selected.
 * Renders the bespoke panel for each tab, or a graceful Phase 3 placeholder.
 */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { ALL_RAIL_ITEMS } from "./rail-items";

import FilesPanel from "./panels/FilesPanel";
import AgentsPanel from "./panels/AgentsPanel";
import LogsPanel from "./panels/LogsPanel";
import DatabasePanel from "./panels/DatabasePanel";
import DeployPanel from "./panels/DeployPanel";
import ProjectsPanel from "./panels/ProjectsPanel";
import CodePanel from "./panels/CodePanel";
import VersionsPanel from "./panels/VersionsPanel";
import AnalyticsPanel from "./panels/AnalyticsPanel";
import RuntimePanel from "./panels/RuntimePanel";
import ActivityFeedPanel from "./panels/ActivityFeedPanel";
import MemoryPanel from "./panels/MemoryPanel";
import DualBrainPanel from "./panels/DualBrainPanel";
import CommandCenterPanel from "./panels/CommandCenterPanel";
import GenericPanel from "./panels/GenericPanel";

export default function SidePanelDrawer({ side }: { side: "left" | "right" }) {
  const { bottomTab, setBottomTab } = useBuilder();
  const item = bottomTab ? ALL_RAIL_ITEMS.find((i) => i.id === bottomTab && i.side === side) : null;

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.id}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className={`relative shrink-0 overflow-hidden bg-[#08080d] ${
            side === "left" ? "border-r border-white/[0.06]" : "border-l border-white/[0.06]"
          }`}
        >
          <div className="flex h-full w-[340px] flex-col">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent px-4">
              <div className="flex items-center gap-2.5">
                <item.icon className="h-4 w-4 text-[#ff6b73]" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.22em] text-foreground/95">
                  {item.label}
                </span>
              </div>
              <button
                onClick={() => setBottomTab(null)}
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                aria-label="Close panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="fb-no-scrollbar flex-1 overflow-y-auto p-3.5">
              {renderPanel(item.id, item.icon, item.label, item.hint)}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function renderPanel(
  id: string,
  Icon: typeof X,
  label: string,
  hint: string,
) {
  switch (id) {
    case "files":     return <FilesPanel />;
    case "agents":    return <AgentsPanel />;
    case "logs":      return <LogsPanel />;
    case "database":  return <DatabasePanel />;
    case "deploy":    return <DeployPanel />;
    case "projects":  return <ProjectsPanel />;
    case "code":      return <CodePanel />;
    case "versions":  return <VersionsPanel />;
    case "analytics": return <AnalyticsPanel />;
    case "runtime":   return <RuntimePanel />;
    case "activity":  return <ActivityFeedPanel />;
    case "memory":    return <MemoryPanel />;
    case "dualbrain": return <DualBrainPanel />;
    default:
      return <GenericPanel icon={Icon as never} title={label} hint={hint} />;
  }
}
