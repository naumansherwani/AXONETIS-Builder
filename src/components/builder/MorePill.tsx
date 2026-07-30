/**
 * Phase 0.1 — Lovable-parity floating "More" glass pill dropdown.
 * Sits at the top of the UnifiedChat column. Opens a menu with:
 *   Analytics · Cloud · Agents · Security · Domains · Payments (stub) · Connectors (stub)
 * Wired items call setBottomTab(...) to open the existing right-rail panels.
 * Stub items (Payments/Connectors) render a "Coming in Phase X" glass card —
 * NO fake data (constitutional principle).
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  MoreHorizontal,
  LineChart,
  Cloud,
  Users,
  Shield,
  Globe,
  CreditCard,
  Plug,
  Search,
  X,
} from "lucide-react";
import { useBuilder, type BottomTabId } from "@/lib/builder-state";

type ItemKind = "panel" | "route" | "stub";
interface Item {
  id: string;
  label: string;
  hint: string;
  icon: typeof LineChart;
  kind: ItemKind;
  tab?: BottomTabId;
  to?: string;
  stubTitle?: string;
  stubBody?: string;
}

const ITEMS: Item[] = [
  {
    id: "analytics",
    label: "Analytics",
    hint: "Cost, tokens, agent performance",
    icon: LineChart,
    kind: "panel",
    tab: "analytics",
  },
  {
    id: "cloud",
    label: "Cloud",
    hint: "Database · Storage · Secrets",
    icon: Cloud,
    kind: "panel",
    tab: "database",
  },
  {
    id: "agents",
    label: "Agents",
    hint: "Jimmy · Sherlock · advisors",
    icon: Users,
    kind: "panel",
    tab: "agents",
  },
  {
    id: "security",
    label: "Security",
    hint: "Sherlock scan · RLS · findings",
    icon: Shield,
    kind: "panel",
    tab: "security",
  },
  {
    id: "domains",
    label: "Domains",
    hint: "Edit URL · Buy · Connect · DNS",
    icon: Globe,
    kind: "route",
    to: "/settings/domains",
  },
  {
    id: "payments",
    label: "Payments",
    hint: "Stripe · Paddle · ANEXVOT AI Pay",
    icon: CreditCard,
    kind: "stub",
    stubTitle: "Payments · Phase 11",
    stubBody:
      "Stripe + Paddle + ANEXVOT AI Pay wiring is scheduled for Phase 11 (Cash Register). No stub data shown — the pill entry is a placeholder only.",
  },
  {
    id: "connectors",
    label: "Connectors",
    hint: "External APIs · OAuth clients",
    icon: Plug,
    kind: "stub",
    stubTitle: "Connectors · Phase 9",
    stubBody:
      "External API + OAuth connector shelf ships in Phase 9. Real wire-up will surface here once the server registry is live.",
  },
  {
    id: "seo",
    label: "SEO",
    hint: "Meta · sitemap · AI-search scan",
    icon: Search,
    kind: "stub",
    stubTitle: "SEO & AI Search · Phase 3.10",
    stubBody:
      "Meta audit, sitemap generator, and AI-search scanner will land inside the 12-Tool Registry (seo.scan tool). No dummy findings shown — real scanner wires up in 3.10.6.",
  },
];

export default function MorePill() {
  const { setBottomTab } = useBuilder();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stub, setStub] = useState<Item | null>(null);

  function activate(it: Item) {
    setOpen(false);
    if (it.kind === "panel" && it.tab) setBottomTab(it.tab);
    else if (it.kind === "route" && it.to) navigate({ to: it.to });
    else if (it.kind === "stub") setStub(it);
  }

  return (
    <>
      <div className="pointer-events-auto absolute right-3 top-3 z-30">
        <button
          onClick={() => setOpen((v) => !v)}
          className="fb-glass inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-black/40 px-3 py-1.5 text-[11px] font-medium text-foreground/90 shadow-[0_10px_40px_-10px_rgba(229,9,20,0.35)] backdrop-blur-xl transition hover:border-[#E50914]/40 hover:text-white"
          title="More tools"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
          More
        </button>

        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-0" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="fb-glass absolute right-0 top-[calc(100%+8px)] z-10 w-[280px] overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a0a10]/95 p-1.5 shadow-[0_30px_80px_-20px_rgba(229,9,20,0.35)] backdrop-blur-2xl"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914]/70 to-transparent" />
                {ITEMS.map((it) => {
                  const Icon = it.icon;
                  const isStub = it.kind === "stub";
                  return (
                    <button
                      key={it.id}
                      onClick={() => activate(it)}
                      className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-md border ${isStub ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-300/80" : "border-white/[0.08] bg-white/[0.03] text-foreground/85 group-hover:border-[#E50914]/40 group-hover:text-[#ff7480]"}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-foreground/95">
                            {it.label}
                          </span>
                          {isStub && (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-[1px] text-[9px] uppercase tracking-wider text-amber-200">
                              Soon
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[10.5px] text-muted-foreground/70">
                          {it.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {stub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-md"
            onClick={() => setStub(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 90, damping: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="fb-glass relative w-[min(480px,92vw)] overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0a0a10] p-6 shadow-[0_30px_120px_-20px_rgba(245,158,11,0.35)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
              <button
                onClick={() => setStub(null)}
                className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-amber-200">
                Roadmap
              </div>
              <h3 className="text-[16px] font-semibold text-foreground">{stub.stubTitle}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                {stub.stubBody}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
