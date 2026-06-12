/**
 * SIDE PANEL DRAWER — opens when any rail icon is selected.
 * Mounted to the right of the LEFT rail (overlay on top of preview center).
 * Visual-only Phase 1 surface; wires to live data in later phases.
 */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { ALL_RAIL_ITEMS } from "./rail-items";

export default function SidePanelDrawer({ side }: { side: "left" | "right" }) {
  const { bottomTab, setBottomTab } = useBuilder();
  const item = bottomTab ? ALL_RAIL_ITEMS.find((i) => i.id === bottomTab && i.side === side) : null;

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.id}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className={`relative shrink-0 overflow-hidden bg-[#08080d] ${
            side === "left" ? "border-r border-white/[0.06]" : "border-l border-white/[0.06]"
          }`}
        >
          <div className="flex h-full w-[320px] flex-col">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
              <div className="flex items-center gap-2.5">
                <item.icon className="h-4 w-4 text-[#ff6b73]" />
                <span className="text-[13px] font-semibold uppercase tracking-wider">{item.label}</span>
              </div>
              <button
                onClick={() => setBottomTab(null)}
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-xs text-muted-foreground">
              <p className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground/60">{item.hint}</p>
              <div className="fb-glass rounded-lg p-4 text-foreground/80">
                <div className="mb-2 text-sm font-semibold">{item.label} panel</div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Phase 1 visual foundation. Phase 2 wires this surface to live data from Supabase 3 +
                  Hetzner bridge.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
