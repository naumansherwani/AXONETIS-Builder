/**
 * Deploy panel — Sandbox → Staging → Production pipeline.
 * Phase 2 visual: shows current state + last deploys. Phase 8 wires to real deploys.
 */
import { PanelSection } from "./PanelChrome";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { motion } from "framer-motion";

type Stage = { key: string; label: string; state: "done" | "active" | "queued" };

const STAGES: Stage[] = [
  { key: "sandbox", label: "Sandbox", state: "done" },
  { key: "staging", label: "Staging", state: "active" },
  { key: "prod", label: "Production", state: "queued" },
];

export default function DeployPanel() {
  return (
    <div>
      <PanelSection title="Pipeline">
        <div className="space-y-1.5 px-1">
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3">
              {s.state === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : s.state === "active" ? (
                <motion.span
                  className="grid h-4 w-4 place-items-center rounded-full bg-[#E50914] shadow-[0_0_12px_#E50914]"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  <span className="h-1 w-1 rounded-full bg-white" />
                </motion.span>
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40" />
              )}
              <div className="flex-1">
                <div className="text-[12px] font-semibold text-foreground/95">{s.label}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {s.state === "done" ? "deployed · 2m ago" : s.state === "active" ? "building…" : "queued"}
                </div>
              </div>
              {i < STAGES.length - 1 && <span className="ml-auto text-muted-foreground/30">→</span>}
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Recent Deploys">
        <div className="space-y-1 text-[11px]">
          {[
            { sha: "a4f2c1d", msg: "phase 1: shell + supabase 3 schema", env: "sandbox", t: "2h" },
            { sha: "9e7b813", msg: "topbar cinematic glow lock", env: "sandbox", t: "5h" },
            { sha: "01f99ab", msg: "founder lock gate", env: "sandbox", t: "9h" },
          ].map((d) => (
            <div key={d.sha} className="flex items-center justify-between rounded px-2 py-1 hover:bg-white/[0.03]">
              <div className="min-w-0">
                <div className="truncate text-foreground/90">{d.msg}</div>
                <div className="font-mono text-[9px] text-muted-foreground/60">{d.sha} · {d.env}</div>
              </div>
              <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">{d.t} ago</span>
            </div>
          ))}
        </div>
      </PanelSection>

      <button className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#E50914] to-[#7c0610] py-2 text-[12px] font-semibold uppercase tracking-wider text-white shadow-[0_8px_30px_-8px_rgba(229,9,20,0.55)]">
        <Rocket className="h-3.5 w-3.5" /> Promote to Production
      </button>
    </div>
  );
}
