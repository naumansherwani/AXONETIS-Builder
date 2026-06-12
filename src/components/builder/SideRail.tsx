/**
 * SIDE RAIL — vertical icon column (Founder OS IDE chrome).
 * Used on the LEFT (project navigation) and RIGHT (Files · Database · Agents · Logs · Deploy).
 * Selecting an item opens a side drawer with the panel for that tab.
 */
import { motion } from "framer-motion";
import { useBuilder, type BottomTabId } from "@/lib/builder-state";
import type { LucideIcon } from "lucide-react";

export interface RailItem {
  id: BottomTabId;
  label: string;
  icon: LucideIcon;
  hint: string;
}

interface Props {
  side: "left" | "right";
  items: RailItem[];
  /** Section label shown vertically at the top of the rail */
  label: string;
}

export default function SideRail({ side, items, label }: Props) {
  const { bottomTab, setBottomTab } = useBuilder();

  return (
    <aside
      className={`relative flex w-[64px] shrink-0 flex-col items-center gap-1 bg-[#06060a] py-3 ${
        side === "left" ? "border-r border-white/[0.06]" : "border-l border-white/[0.06]"
      }`}
    >
      {/* vertical section label */}
      <div
        className="mb-2 select-none whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.3em] text-muted-foreground/60"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {label}
      </div>

      <div className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto fb-no-scrollbar">
        {items.map((it) => {
          const Icon = it.icon;
          const active = bottomTab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setBottomTab(active ? null : it.id)}
              title={`${it.label} — ${it.hint}`}
              className={`group relative grid h-11 w-11 place-items-center rounded-lg border transition-all ${
                active
                  ? "border-[#E50914]/40 bg-[#E50914]/10 text-[#ff6b73] shadow-[0_0_20px_-4px_rgba(229,9,20,0.5)]"
                  : "border-transparent text-muted-foreground hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {active && (
                <motion.span
                  layoutId={`rail-active-${side}`}
                  className={`absolute ${side === "left" ? "-right-[5px]" : "-left-[5px]"} top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914]`}
                />
              )}
              <span className="mt-0.5 text-[8.5px] font-medium uppercase tracking-wider opacity-80 absolute -bottom-0.5">
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
