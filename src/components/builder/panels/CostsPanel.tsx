/**
 * Costs panel — real-time token burn + $ cost from Hetzner brain.
 * Killer feature: per-model breakdown, window switch (1h/24h/7d/30d).
 */
import { useEffect, useState } from "react";
import { Coins, Loader2, TrendingUp, Zap } from "lucide-react";
import { PanelSection, Row } from "./PanelChrome";
import { fetchCosts, type CostsSnapshot } from "@/lib/costs-api";

const WINDOWS: CostsSnapshot["window"][] = ["1h", "24h", "7d", "30d"];

export default function CostsPanel() {
  const [snap, setSnap] = useState<CostsSnapshot | null>(null);
  const [win, setWin] = useState<CostsSnapshot["window"]>("24h");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCosts(win)
      .then((s) => { if (alive) setSnap(s); })
      .finally(() => { if (alive) setLoading(false); });
    const iv = setInterval(() => {
      fetchCosts(win).then((s) => { if (alive) setSnap(s); });
    }, 15_000);
    return () => { alive = false; clearInterval(iv); };
  }, [win]);

  return (
    <div>
      <PanelSection
        title="Cost Meter"
        action={
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider transition ${
                  win === w
                    ? "bg-[#E50914]/20 text-[#ff7480]"
                    : "text-muted-foreground/60 hover:text-foreground"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        }
      >
        <Row
          left={<><Coins className="h-3.5 w-3.5 text-[#ff7480]" /><span>Total spend</span></>}
          right={
            <span className="font-mono text-foreground">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : `$${(snap?.total_usd ?? 0).toFixed(4)}`}
            </span>
          }
        />
        <Row
          left={<><Zap className="h-3.5 w-3.5 text-[#a855f7]" /><span>Requests</span></>}
          right={<span className="font-mono">{snap?.total_requests ?? 0}</span>}
        />
        <Row
          left={<><TrendingUp className="h-3.5 w-3.5 text-emerald-400" /><span>Tokens</span></>}
          right={<span className="font-mono">{(snap?.total_tokens ?? 0).toLocaleString()}</span>}
        />
      </PanelSection>

      <PanelSection
        title="By model"
        action={<span className="text-[10px] text-muted-foreground/60">{snap?.by_model.length ?? 0}</span>}
      >
        {!snap?.by_model.length ? (
          <div className="px-2 py-3 text-[11px] text-muted-foreground/60">
            {snap?.live ? "No usage in window." : "Server offline — waiting for brain."}
          </div>
        ) : (
          <div className="flex flex-col">
            {snap.by_model.map((m) => (
              <Row
                key={m.model}
                left={<span className="truncate font-mono text-[11px]">{m.model}</span>}
                right={
                  <span className="flex items-center gap-2 font-mono text-[10.5px]">
                    <span className="text-muted-foreground/70">{m.requests}×</span>
                    <span className="text-[#ff7480]">${m.cost_usd.toFixed(4)}</span>
                  </span>
                }
              />
            ))}
          </div>
        )}
      </PanelSection>

      <div className="mt-2 flex items-center justify-between px-2 text-[10px] text-muted-foreground/50">
        <span>{snap?.live ? "● live" : "○ offline"}</span>
        <span>{snap ? new Date(snap.fetched_at).toLocaleTimeString() : ""}</span>
      </div>
    </div>
  );
}
