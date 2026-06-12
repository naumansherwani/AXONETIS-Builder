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
import HorizontalSplit from "./HorizontalSplit";
import type { BridgeStatus, PreviewBridgeEvent } from "@/lib/preview-bridge";

/**
 * FOUNDER OS SHELL
 * ┌──────────────────── TopBar (92px, cinematic) ────────────────────┐
 * │ LeftRail │ [Drawer] │ Unified Chat │ Live Preview│ [Drawer] │Right│
 * │  (64)    │  (340)?  │    ~40%      │    ~60%     │  (340)?  │Rail │
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
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("standby");
  const [lastBridgeEvent, setLastBridgeEvent] = useState<PreviewBridgeEvent | null>(null);

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
      project, branch, environment, bottomTab, previewMode, paletteOpen, agentState, bridgeStatus, lastBridgeEvent,
      setProject, setBranch, setEnvironment, setBottomTab, setPreviewMode, setPaletteOpen, setAgentState,
      setBridgeStatus, setLastBridgeEvent,
    }),
    [project, branch, environment, bottomTab, previewMode, paletteOpen, agentState, bridgeStatus, lastBridgeEvent],
  );

  return (
    <BuilderCtx.Provider value={value}>
      <div className="fb-cinematic-shell relative flex h-screen w-full flex-col overflow-hidden text-foreground">
        {/* Ambient cinematic glow — drives the "3D" depth across the whole shell */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(60% 50% at 18% 0%, rgba(229,9,20,0.18) 0%, transparent 60%)," +
              "radial-gradient(50% 45% at 82% 0%, rgba(168,85,247,0.14) 0%, transparent 65%)," +
              "radial-gradient(70% 40% at 50% 100%, rgba(229,9,20,0.10) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px)," +
              "linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative z-10 flex h-full flex-col">
          <TopBar />

          <div className="flex min-h-0 flex-1">
            <SideRail side="left" items={LEFT_RAIL_ITEMS} label="Navigate" />
            <SidePanelDrawer side="left" />

            <main className="flex min-w-0 flex-1 flex-col">
              <HorizontalSplit
                left={<UnifiedChat />}
                right={<LivePreview />}
                initial={0.4}
              />
            </main>

            <SidePanelDrawer side="right" />
            <SideRail side="right" items={RIGHT_RAIL_ITEMS} label="Workspace" />
          </div>

          <StatusBar />
          <CommandPalette />
        </div>
      </div>
    </BuilderCtx.Provider>
  );
}
