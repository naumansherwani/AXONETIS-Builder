/**
 * Phase 3.9.6 — Agent Marketplace panel.
 * Grid of installable agents (browse · install · uninstall · enable).
 * Reads from /rpc/marketplace.list + /rpc/marketplace.installed via marketplace-api.
 * Server pending → shows empty state, never crashes.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Loader2, Search, Sparkles, Star, Trash2 } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import {
  installAgent,
  listInstalled,
  listMarketplace,
  uninstallAgent,
  type InstalledAgent,
  type MarketplaceAgent,
  type MarketplaceCategory,
} from "@/lib/marketplace-api";
import { PanelSection } from "./PanelChrome";

const CATS: Array<{ id: MarketplaceCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "build", label: "Build" },
  { id: "review", label: "Review" },
  { id: "ops", label: "Ops" },
  { id: "data", label: "Data" },
  { id: "creative", label: "Creative" },
  { id: "outreach", label: "Outreach" },
];

export default function MarketplacePanel() {
  const { project } = useBuilder();
  const [agents, setAgents] = useState<MarketplaceAgent[] | null>(null);
  const [installed, setInstalled] = useState<InstalledAgent[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<MarketplaceCategory | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    const [list, inst] = await Promise.all([listMarketplace(), listInstalled(project)]);
    setAgents(list);
    setInstalled(inst);
    setLive(list.length > 0 || inst.length > 0);
  }, [project]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [list, inst] = await Promise.all([listMarketplace(), listInstalled(project)]);
      if (!alive) return;
      setAgents(list);
      setInstalled(inst);
      setLive(list.length > 0 || inst.length > 0);
    })();
    return () => { alive = false; };
  }, [project]);

  const installedSet = useMemo(() => new Set(installed.map((i) => i.slug)), [installed]);

  const filtered = useMemo(() => {
    const src = agents ?? [];
    const needle = q.trim().toLowerCase();
    return src.filter((a) => {
      if (cat !== "all" && a.category !== cat) return false;
      if (!needle) return true;
      return (
        a.name.toLowerCase().includes(needle) ||
        a.tagline.toLowerCase().includes(needle) ||
        a.slug.toLowerCase().includes(needle)
      );
    });
  }, [agents, q, cat]);

  const onInstall = async (a: MarketplaceAgent) => {
    setBusy(a.slug);
    const res = await installAgent(project, a.slug);
    if (res?.ok) await refresh();
    setBusy(null);
  };
  const onUninstall = async (slug: string) => {
    setBusy(slug);
    const res = await uninstallAgent(project, slug);
    if (res?.ok) await refresh();
    setBusy(null);
  };

  return (
    <div>
      <PanelSection
        title="Agent Marketplace"
        action={<span className="text-[10px] text-muted-foreground/60">{installed.length} installed</span>}
      >
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents…"
              className="h-7 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-7 pr-2 font-mono text-[11px] outline-none placeholder:text-muted-foreground/40 focus:border-[#E50914]/40"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider transition ${
                  cat === c.id
                    ? "bg-[#E50914]/20 text-[#ff7480]"
                    : "text-muted-foreground/60 hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Available" action={<span className="text-[10px] text-muted-foreground/60">{filtered.length}</span>}>
        {agents === null ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" /></div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-4 text-[11px] text-muted-foreground/60">
            {live ? "No agents match filter." : "Marketplace endpoint pending on Hetzner — /rpc/marketplace.list."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 px-2">
            {filtered.map((a) => {
              const isInstalled = installedSet.has(a.slug);
              const isBusy = busy === a.slug;
              return (
                <div
                  key={a.slug}
                  className="group relative rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 transition hover:border-[#E50914]/30 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start gap-2">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[0.06] bg-black/40 text-sm">
                      {a.icon ?? "🤖"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-[11.5px] font-semibold text-foreground">{a.name}</span>
                        {a.official && <Sparkles className="h-2.5 w-2.5 shrink-0 text-[#E50914]" />}
                        {a.featured && <Star className="h-2.5 w-2.5 shrink-0 text-amber-400" />}
                      </div>
                      <p className="truncate text-[10.5px] text-muted-foreground/80">{a.tagline}</p>
                      <div className="mt-1 flex items-center gap-2 text-[9.5px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                        <span>{a.category}</span>
                        <span>·</span>
                        <span>{a.installs.toLocaleString()}↓</span>
                        <span>·</span>
                        <span>{a.price_usd > 0 ? `$${a.price_usd}` : "free"}</span>
                      </div>
                    </div>
                    {isInstalled ? (
                      <button
                        disabled={isBusy}
                        onClick={() => onUninstall(a.slug)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/[0.06] text-muted-foreground/70 transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-40"
                        title="Uninstall"
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    ) : (
                      <button
                        disabled={isBusy}
                        onClick={() => onInstall(a)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#E50914]/40 bg-[#E50914]/10 text-[#ff7480] transition hover:bg-[#E50914]/20 disabled:opacity-40"
                        title="Install"
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                  {isInstalled && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 rounded-b-lg bg-gradient-to-t from-emerald-500/10 to-transparent px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-emerald-300/80">
                      <CheckCircle2 className="h-2.5 w-2.5" /> installed
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>

      <div className="mt-2 flex items-center justify-between px-2 text-[10px] text-muted-foreground/50">
        <span>{live ? "● live" : "○ offline"}</span>
        <span>{agents?.length ?? 0} listings</span>
      </div>
    </div>
  );
}
