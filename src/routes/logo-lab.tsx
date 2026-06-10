import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/builder-state";
import PulseNode from "@/components/builder/logo-lab/PulseNode";
import CorePrism from "@/components/builder/logo-lab/CorePrism";
import Wordmark from "@/components/builder/logo-lab/Wordmark";
import KernelLogo from "@/components/builder/KernelLogo";

export const Route = createFileRoute("/logo-lab")({
  head: () => ({ meta: [{ title: "Logo Lab — F-OS" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LogoLab,
});

const STATES: AgentState[] = ["standby", "jimmy", "sherlock"];

function LogoLab() {
  const [auto, setAuto] = useState(true);
  const [state, setState] = useState<AgentState>("standby");

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setState((s) => STATES[(STATES.indexOf(s) + 1) % STATES.length]);
    }, 2400);
    return () => clearInterval(id);
  }, [auto]);

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      {/* FUTURE-X BACKGROUND — deep obsidian + crimson nebula + violet aurora */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(229,9,20,0.18), transparent 60%),\
             radial-gradient(ellipse 70% 50% at 100% 20%, rgba(168,85,247,0.16), transparent 65%),\
             radial-gradient(ellipse 90% 70% at 50% 100%, rgba(56,189,248,0.10), transparent 70%),\
             linear-gradient(180deg, #07060a 0%, #0a0810 50%, #050409 100%)",
        }}
      />
      {/* fine grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 80%)",
        }}
      />
      {/* breathing aurora ring */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/3 -z-10 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "conic-gradient(from 0deg, #E50914 0%, #a855f7 40%, #38bdf8 70%, #E50914 100%)", opacity: 0.12 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Founder · Logo Lab · F-OS</div>
          <h1 className="mt-2 bg-gradient-to-r from-white via-white to-[#E50914] bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Choose the identity
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Teen directions, sab live agent-state ke saath. Auto-cycle: standby → jimmy → sherlock har 2.4s.
            Manual lock ke liye buttons dabao.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAuto((a) => !a)}
              className="h-8 rounded-md border border-white/[0.1] bg-white/[0.03] px-3 text-xs hover:bg-white/[0.06]"
            >
              {auto ? "Pause auto-cycle" : "Resume auto-cycle"}
            </button>
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => { setAuto(false); setState(s); }}
                className={`h-8 rounded-md border px-3 text-xs uppercase tracking-wider transition-colors ${
                  state === s
                    ? "border-[#E50914]/40 bg-[#E50914]/10 text-foreground"
                    : "border-white/[0.1] bg-white/[0.02] text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
            <div className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
              Active: <span className="text-foreground">{state}</span>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid gap-5 md:grid-cols-2">
          <Card label="Option A · Pulse Node" tag="Recommended" note="Radar core. Minimal, alive, never wraps. Vision Pro / Neuralink feel.">
            <PulseNode state={state} size={22} />
          </Card>
          <Card label="Option B · Core Prism" note="3 faces = Founder / Jimmy / Sherlock. Active agent face lights up.">
            <CorePrism state={state} size={30} />
          </Card>
          <Card label="Option C · Wordmark" note="Pure type. Gradient shimmer reacts to agent. Safest, scales infinitely.">
            <Wordmark state={state} />
          </Card>
          <Card label="Current · Kernel Hexa-Grid" note="Pichla version (jo top bar mein abhi tha)." muted>
            <KernelLogo state={state} size={18} />
          </Card>
        </div>

        {/* Top-bar simulation */}
        <div className="mt-12">
          <div className="mb-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Top-bar simulation</div>
          <div className="space-y-2">
            {(["A — PulseNode", "B — CorePrism", "C — Wordmark"] as const).map((label, i) => (
              <div
                key={label}
                className="flex h-11 items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 backdrop-blur-xl"
              >
                <div className="w-[140px] whitespace-nowrap text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
                <div className="flex-1">
                  {i === 0 && <PulseNode state={state} size={18} />}
                  {i === 1 && <CorePrism state={state} size={24} />}
                  {i === 2 && <Wordmark state={state} />}
                </div>
                <span className="whitespace-nowrap text-[10px] uppercase tracking-widest text-muted-foreground">
                  HostFlow · main · Sandbox
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          Choose karne ke baad bolo <span className="text-foreground">"A lago"</span>,{" "}
          <span className="text-foreground">"B lago"</span>, ya <span className="text-foreground">"C lago"</span>.
        </div>
      </div>
    </div>
  );
}

function Card({
  label, note, tag, muted, children,
}: { label: string; note: string; tag?: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl ${muted ? "opacity-60" : ""}`}
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.02), 0 30px 80px -20px rgba(229,9,20,0.18)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        {tag && (
          <span className="rounded-full border border-[#E50914]/30 bg-[#E50914]/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-[#E50914]">
            {tag}
          </span>
        )}
      </div>
      <div
        className="grid h-32 place-items-center rounded-lg border border-white/[0.06]"
        style={{ background: "radial-gradient(ellipse at center, rgba(168,85,247,0.08), rgba(0,0,0,0.4) 70%)" }}
      >
        {children}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </motion.div>
  );
}
