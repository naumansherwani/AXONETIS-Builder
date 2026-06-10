import { useEffect, useMemo, useState } from "react";
import { BuilderCtx, type AgentState, type BottomTabId, type PreviewMode } from "@/lib/builder-state";
import { DEFAULT_PROJECT, type Branch, type Environment, type ProjectId } from "@/lib/projects";
import TopBar from "./TopBar";
import LivePreview from "./LivePreview";
import UnifiedChat from "./UnifiedChat";
import BottomTabs from "./BottomTabs";
import StatusBar from "./StatusBar";
import CommandPalette from "./CommandPalette";

export default function BuilderShell() {
  const [project, setProject] = useState<ProjectId>(DEFAULT_PROJECT);
  const [branch, setBranch] = useState<Branch>("main");
  const [environment, setEnvironment] = useState<Environment>("Sandbox");
  const [bottomTab, setBottomTab] = useState<BottomTabId | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("single");
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K opens command palette
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
      project, branch, environment, bottomTab, previewMode, paletteOpen,
      setProject, setBranch, setEnvironment, setBottomTab, setPreviewMode, setPaletteOpen,
    }),
    [project, branch, environment, bottomTab, previewMode, paletteOpen],
  );

  return (
    <BuilderCtx.Provider value={value}>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
        <TopBar />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-[1.4] border-b border-white/[0.06]">
            <LivePreview />
          </div>
          <div className="min-h-0 flex-1">
            <UnifiedChat />
          </div>
        </div>
        <BottomTabs />
        <StatusBar />
        <CommandPalette />
      </div>
    </BuilderCtx.Provider>
  );
}
