import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/builder-state";
import AxenMark from "@/components/builder/logo-lab/AxonMark";

export const Route = createFileRoute("/logo-lab")({
  head: () => ({
    meta: [{ title: "AXONET — Identity" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LogoLab,
});

const STATES: AgentState[] = ["standby", "jimmy", "sherlock"];

const TAGLINES = [
  {
    line: "The nervous system for autonomous agents.",
    note: "Founder-grade. Literal. Future-proof.",
  },
  {
    line: "Every signal becomes software.",
    note: "Punchy. Pure AXONET DNA — input → fire → build.",
  },
  {
    line: "Where intelligence finds its body.",
    note: "Poetic. Positions AXONET as the substrate, not a tool.",
  },
  { line: "Think. Fire. Build.", note: "3-word manifesto. Tesla/Apple cadence. T-shirt ready." },
  {
    line: "The synapse of the autonomous age.",
    note: "Mythic, civilizational. Pair with hero films.",
  },
  {
    line: "Built by signals. Born autonomous.",
    note: "Self-describing — explains the product in 4 words.",
  },
];

function LogoLab() {
  const [auto, setAuto] = useState(true);
  const [state, setState] = useState<AgentState>("standby");

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(
      () => setState((s) => STATES[(STATES.indexOf(s) + 1) % STATES.length]),
      2600,
    );
    return () => clearInterval(id);
  }, [auto]);

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      {/* CINEMATIC BACKGROUND — deep obsidian + crimson nebula + violet aurora */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 18% 8%, rgba(229,9,20,0.16), transparent 60%)," +
            "radial-gradient(ellipse 60% 45% at 92% 18%, rgba(168,85,247,0.14), transparent 65%)," +
            "radial-gradient(ellipse 90% 70% at 50% 110%, rgba(56,189,248,0.10), transparent 70%)," +
            "linear-gradient(180deg, #06050a 0%, #0a0810 50%, #040308 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 80%)",
        }}
      />
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-[42%] -z-10 h-[820px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "conic-gradient(from 0deg, #E50914 0%, #a855f7 40%, #38bdf8 70%, #E50914 100%)",
          opacity: 0.1,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
          Founder · Identity System · v1.0
        </div>

        {/* HERO — the mark, monumental */}
        <div
          className="mt-10 grid place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.015] py-20 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.02) inset, 0 60px 160px -40px rgba(229,9,20,0.25)",
          }}
        >
          <AxenMark state={state} size={220} />
          <div className="mt-10 text-center">
            <div
              className="text-[64px] font-semibold uppercase leading-none text-white"
              style={{
                fontFamily: "'Geist Mono','JetBrains Mono',ui-monospace,monospace",
                letterSpacing: "0.42em",
                textShadow: "0 0 60px rgba(229,9,20,0.35), 0 0 120px rgba(168,85,247,0.2)",
              }}
            >
              AXONET
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.45em] text-muted-foreground">
              Autonomous · eXecution · Orchestration · Network
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAuto((a) => !a)}
            className="h-8 rounded-md border border-white/[0.1] bg-white/[0.03] px-3 text-xs hover:bg-white/[0.06]"
          >
            {auto ? "Pause auto-cycle" : "Resume auto-cycle"}
          </button>
          {STATES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setAuto(false);
                setState(s);
              }}
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
            Live state: <span className="text-foreground">{state}</span>
          </div>
        </div>

        {/* SCALE TEST — favicon → top-bar → splash */}
        <div className="mt-12 mb-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Scale test
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[16, 32, 64, 120].map((sz) => (
            <div
              key={sz}
              className="grid h-32 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.02]"
            >
              <div className="flex flex-col items-center gap-2">
                <AxenMark state={state} size={sz} />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {sz}px
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* LOCKUPS */}
        <div className="mt-10 mb-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Lockups
        </div>
        <div className="grid gap-3">
          {/* Top-bar */}
          <div className="flex h-12 items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 backdrop-blur-xl">
            <AxenMark state={state} size={22} wordmark />
            <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
              builder · main · Sandbox
            </span>
          </div>
          {/* Boot splash */}
          <div className="grid h-44 place-items-center rounded-lg border border-white/[0.08] bg-black/40">
            <AxenMark state={state} size={56} wordmark />
          </div>
          {/* Centered card */}
          <div className="grid h-28 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
            <AxenMark state={state} size={32} wordmark />
          </div>
        </div>

        {/* TAGLINES */}
        <div className="mt-14">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Tagline candidates
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Mera vote:{" "}
            <span className="text-foreground">"The nervous system for autonomous agents."</span> —
            literal product description, founder-grade, 2099 mein bhi sahi rahegi.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {TAGLINES.map((t, i) => (
              <motion.div
                key={t.line}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 80, damping: 15 }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-xl"
              >
                <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                  Option {i + 1}
                </div>
                <div className="mt-2 text-lg font-medium text-foreground">{t.line}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t.note}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center text-xs text-muted-foreground">
          Lock karne ke liye bolo: <span className="text-foreground">"Axon lago, tagline 1"</span>{" "}
          (ya jo number bhi).
        </div>
      </div>
    </div>
  );
}
