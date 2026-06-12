import { useEffect, useMemo, useState } from "react";
import { BuilderCtx, type AgentState, type BottomTabId, type PreviewMode } from "@/lib/builder-state";
import { DEFAULT_PROJECT, type Branch, type Environment, type ProjectId } from "@/lib/projects";
import TopBar from "./TopBar";
import LivePreview from "./LivePreview";
import UnifiedChat from "./UnifiedChat";
import StatusBar from "./StatusBar";
import CommandPalette from "./CommandPalette";
import SideRail from "./SideRail";
import SidePanelDrawer from "./SidePanelDrawer";
import { LEFT_RAIL_ITEMS, RIGHT_RAIL_ITEMS } from "./rail-items";

/**
 * FOUNDER OS SHELL
 * ┌──────────────────── TopBar (92px, cinematic) ────────────────────┐
 * │ LeftRail │ [Drawer] │ Live Preview              │ [Drawer] │ Right│
 * │  (64)    │  (320)?  │ ─────────────────────────│  (320)?  │ Rail │
 * │          │          │ Unified Build Chat        │          │ (64) │
 * └──────────────────── StatusBar (24) ─────────────────────────────┘
 */
export default function BuilderShell() {
  const [project, setProject] = useState<ProjectId>(DEFAULT_PROJECT);
  const [branch, setBranch] = useState<Branch>("main");
  const [environment, setEnvironment] = useState<Environment>("Sandbox");
  const [bottomTab, setBottomTab] = useState<BottomTabId | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("single");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>("standby");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({
      project, branch, environment, bottomTab, previewMode, paletteOpen, agentState,
      setProject, setBranch, setEnvironment, setBottomTab, setPreviewMode, setPaletteOpen, setAgentState,
    }),
    [project, branch, environment, bottomTab, previewMode, paletteOpen, agentState],
  );

  return (
    <BuilderCtx.Provider value={value}>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-[#040406] text-foreground">
        <TopBar />

        <div className="flex min-h-0 flex-1">
          <SideRail side="left" items={LEFT_RAIL_ITEMS} label="Navigate" />
          <SidePanelDrawer side="left" />

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-[1.55] border-b border-white/[0.06]">
              <LivePreview />
            </div>
            <div className="min-h-0 flex-1">
              <UnifiedChat />
            </div>
          </main>

          <SidePanelDrawer side="right" />
          <SideRail side="right" items={RIGHT_RAIL_ITEMS} label="Workspace" />
        </div>

        <StatusBar />
        <CommandPalette />
      </div>
    </BuilderCtx.Provider>
  );
}
