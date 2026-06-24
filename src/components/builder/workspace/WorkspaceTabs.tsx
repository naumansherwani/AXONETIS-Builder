/**
 * Phase A1 — Workspace tab orchestrator.
 * - Persists tab list + active to localStorage (axonetis.workspace.tabs.v1).
 * - Keyboard: Ctrl+1..9 switch, Ctrl+W close, Ctrl+T quick-open palette stub.
 * - Mounts only the active tab's panel inside a min-h-0 flex column.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import TabBar from "./TabBar";
import { TAB_REGISTRY, TAB_KINDS, type TabKind } from "./tab-registry";

const STORAGE_KEY = "axonetis.workspace.tabs.v1";

interface PersistedState {
  tabs: TabKind[];
  active: TabKind;
}

function load(): PersistedState {
  if (typeof window === "undefined") return { tabs: ["preview"], active: "preview" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tabs: ["preview"], active: "preview" };
    const parsed = JSON.parse(raw) as PersistedState;
    const tabs = (parsed.tabs ?? []).filter((k) => TAB_KINDS.includes(k));
    if (tabs.length === 0) tabs.push("preview");
    const active = TAB_KINDS.includes(parsed.active) && tabs.includes(parsed.active) ? parsed.active : tabs[0];
    return { tabs, active };
  } catch {
    return { tabs: ["preview"], active: "preview" };
  }
}

export default function WorkspaceTabs() {
  const [{ tabs, active }, setState] = useState<PersistedState>(() => load());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, active })); } catch { /* noop */ }
  }, [tabs, active]);

  const openTab = useCallback((kind: TabKind) => {
    setState((s) => {
      if (s.tabs.includes(kind)) return { ...s, active: kind };
      return { tabs: [...s.tabs, kind], active: kind };
    });
  }, []);

  const closeTab = useCallback((kind: TabKind) => {
    setState((s) => {
      if (!TAB_REGISTRY[kind].closable) return s;
      const next = s.tabs.filter((k) => k !== kind);
      if (next.length === 0) next.push("preview");
      const active = s.active === kind ? next[next.length - 1] : s.active;
      return { tabs: next, active };
    });
  }, []);

  // Expose imperative openTab via window for StatusBar chips (Phase A1 wiring).
  useEffect(() => {
    (window as unknown as { axonetisOpenTab?: (k: TabKind) => void }).axonetisOpenTab = openTab;
    return () => { delete (window as unknown as { axonetisOpenTab?: (k: TabKind) => void }).axonetisOpenTab; };
  }, [openTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        if (tabs[idx]) { e.preventDefault(); setState((s) => ({ ...s, active: tabs[idx] })); }
      } else if (e.key.toLowerCase() === "w") {
        e.preventDefault(); closeTab(active);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, active, closeTab]);

  const ActiveComponent = useMemo(() => TAB_REGISTRY[active].render, [active]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TabBar tabs={tabs} active={active} onSelect={(k) => setState((s) => ({ ...s, active: k }))} onClose={closeTab} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Keep all opened tabs mounted to preserve scroll/state; show only active. */}
        {tabs.map((kind) => {
          const Comp = TAB_REGISTRY[kind].render;
          const isActive = kind === active;
          return (
            <div
              key={kind}
              className={`absolute inset-0 flex min-h-0 flex-col ${isActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"}`}
              aria-hidden={!isActive}
            >
              <Comp />
            </div>
          );
        })}
        {/* SSR fallback ref */}
        {tabs.length === 0 && <ActiveComponent />}
      </div>
    </div>
  );
}
