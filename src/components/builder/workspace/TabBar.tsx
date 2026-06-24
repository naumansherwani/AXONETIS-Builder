/**
 * Phase A1 — Glass tab strip. Active glow, close button, scrollable overflow.
 */
import { X, Plus } from "lucide-react";
import { TAB_REGISTRY, type TabKind } from "./tab-registry";

export interface TabBarProps {
  tabs: TabKind[];
  active: TabKind;
  onSelect: (kind: TabKind) => void;
  onClose: (kind: TabKind) => void;
  onAdd?: () => void;
}

export default function TabBar({ tabs, active, onSelect, onClose, onAdd }: TabBarProps) {
  return (
    <div className="relative flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-white/[0.06] bg-background/60 px-1.5 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914]/30 to-transparent" />
      {tabs.map((kind) => {
        const def = TAB_REGISTRY[kind];
        const isActive = kind === active;
        const Icon = def.icon;
        return (
          <div
            key={kind}
            className={`group relative flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md border px-2 text-[11px] transition-all ${
              isActive
                ? "border-[#E50914]/40 bg-[#E50914]/10 text-foreground shadow-[0_0_18px_-4px_rgba(229,9,20,0.45)]"
                : "border-transparent text-muted-foreground hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-foreground"
            }`}
            onClick={() => onSelect(kind)}
            role="tab"
            aria-selected={isActive}
          >
            <Icon className="h-3 w-3" />
            <span className="font-medium">{def.label}</span>
            {def.closable && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose(kind); }}
                className="ml-1 grid h-3.5 w-3.5 place-items-center rounded opacity-0 transition-opacity hover:bg-white/[0.1] group-hover:opacity-100"
                aria-label={`Close ${def.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        );
      })}
      {onAdd && (
        <button
          onClick={onAdd}
          className="ml-1 grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          title="Open tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
