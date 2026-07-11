import { useEffect, useMemo, useState } from "react";
import { BuilderCtx, type AgentState, type BottomTabId, type PreviewMode } from "@/lib/builder-state";
import { DEFAULT_PROJECT, type Branch, type Environment, type ProjectId } from "@/lib/projects";
import TopBar from "./TopBar";
import WorkspaceTabs from "./workspace/WorkspaceTabs";
import UnifiedChat from "./UnifiedChat";
import StatusBar from "./StatusBar";
import CommandPalette from "./CommandPalette";
import SideRail from "./SideRail";
import SidePanelDrawer from "./SidePanelDrawer";
import { LEFT_RAIL_ITEMS, RIGHT_RAIL_ITEMS } from "./rail-items";
import HorizontalSplit from "./HorizontalSplit";
import type { BridgeStatus, PreviewBridgeEvent } from "@/lib/preview-bridge";
import type { PreviewEnv, PreviewFileChange } from "@/lib/preview-engine";
import { loadWorkspace, patchWorkspace } from "@/lib/project-workspace";
import { useRrwebRecorder } from "@/lib/rrweb-recorder";

const ACTIVE_PROJECT_KEY = "axonetis.phase7.activeProject.v1";

export default function BuilderShell() {
  const [project, setProject] = useState<ProjectId>(() => {
    if (typeof window === "undefined") return DEFAULT_PROJECT;
    return (localStorage.getItem(ACTIVE_PROJECT_KEY) as ProjectId | null) ?? DEFAULT_PROJECT;
  });
  const initialWs = useMemo(() => loadWorkspace(project, []), [project]);
  const [branch, setBranch] = useState<Branch>(initialWs.branch);
  const [environment, setEnvironment] = useState<Environment>(initialWs.environment);
  const [previewEnv, setPreviewEnv] = useState<PreviewEnv>(initialWs.previewEnv);
  const [bottomTab, setBottomTab] = useState<BottomTabId | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("single");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>("standby");
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("standby");
  const [lastBridgeEvent, setLastBridgeEvent] = useState<PreviewBridgeEvent | null>(null);
  const [lastPreviewChange, setLastPreviewChange] = useState<PreviewFileChange | null>(null);

  // Phase 7 — when project switches, hydrate isolated state from its workspace.
  useEffect(() => {
    const ws = loadWorkspace(project, []);
    setBranch(ws.branch);
    setEnvironment(ws.environment);
    setPreviewEnv(ws.previewEnv);
    setLastBridgeEvent(null);
    setLastPreviewChange(null);
    try { localStorage.setItem(ACTIVE_PROJECT_KEY, project); } catch { /* noop */ }
  }, [project]);

  // Persist branch / env / previewEnv changes back into the active project's workspace.
  useEffect(() => { patchWorkspace(project, { branch, environment, previewEnv }); }, [project, branch, environment, previewEnv]);

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
      previewEnv, lastPreviewChange,
      setProject, setBranch, setEnvironment, setBottomTab, setPreviewMode, setPaletteOpen, setAgentState,
      setBridgeStatus, setLastBridgeEvent, setPreviewEnv, setLastPreviewChange,
    }),
    [project, branch, environment, bottomTab, previewMode, paletteOpen, agentState, bridgeStatus, lastBridgeEvent, previewEnv, lastPreviewChange],
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

            <main className="relative flex min-w-0 flex-1 flex-col">
              {/* Phase 7 — continuous ribbon that links chat + preview top corners */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-[#E50914]/0 via-[#E50914]/70 to-[#7c3aed]/0" />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] bg-gradient-to-r from-transparent via-[#E50914]/30 to-transparent blur-sm" />
              <HorizontalSplit
                left={<UnifiedChat />}
                right={<WorkspaceTabs />}
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
