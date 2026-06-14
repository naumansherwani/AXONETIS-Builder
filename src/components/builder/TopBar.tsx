import { useEffect, useState } from "react";
import { ChevronDown, Command, LogOut, Rocket, User } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useBuilder } from "@/lib/builder-state";
import { BRANCHES, ENVIRONMENTS, PROJECTS, type Branch, type Environment, type ProjectId } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";
import AxenMark from "./logo-lab/AxonMark";
import PublishModal from "./PublishModal";
import { supabaseLabelFor } from "@/lib/project-workspace";

/**
 * FOUNDER OS TOP BAR — cinematic command bar.
 * Spec: header ≥88px · logo 72px · wordmark 2.5x · brand area ~25% width.
 */
export default function TopBar() {
  const navigate = useNavigate();
  const { project, branch, environment, agentState, setProject, setBranch, setEnvironment, setPaletteOpen, setAgentState } = useBuilder();
  const [publishOpen, setPublishOpen] = useState(false);
  const active = PROJECTS.find((p) => p.id === project)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "1") setAgentState("standby");
      if (e.key === "2") setAgentState("jimmy");
      if (e.key === "3") setAgentState("sherlock");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAgentState]);

  async function handleSignOut() {
    if (SUPABASE3_READY) await supabase3.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="relative flex h-[80px] shrink-0 items-center justify-between gap-6 border-b bg-[#0F172A]/85 px-8 backdrop-blur-2xl"
      style={{ borderBottomColor: "rgba(255,255,255,0.08)" }}
    >
      {/* Cinematic top hairline glow — strong */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914] to-transparent opacity-90" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#E50914]/40 to-transparent blur-sm" />
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-black/30" />

      {/* LEFT — BRAND with cinematic halo */}
      <div className="relative flex shrink-0 items-center gap-3.5">
        <div
          className="pointer-events-none absolute -inset-x-6 -inset-y-3 -z-10 rounded-3xl opacity-90"
          style={{
            background:
              "radial-gradient(60% 80% at 18% 50%, rgba(229,9,20,0.28) 0%, rgba(168,85,247,0.12) 45%, transparent 75%)",
            filter: "blur(14px)",
          }}
        />
        <AxenMark state={agentState} size={48} />
        <div className="flex flex-col justify-center leading-none">
          {/* Row 1: AXONETIS + tagline inline */}
          <div className="flex items-baseline gap-3 whitespace-nowrap">
            <span
              className="font-bold uppercase text-[#F8FAFC]"
              style={{
                fontFamily: "'Geist Mono','JetBrains Mono',ui-monospace,monospace",
                fontSize: 20,
                letterSpacing: "0.18em",
                lineHeight: 1,
                textShadow:
                  "0 0 8px rgba(229,9,20,0.55), 0 0 28px rgba(229,9,20,0.35), 0 0 56px rgba(168,85,247,0.22), 0 0 90px rgba(229,9,20,0.12)",
              }}
            >
              AXONETIS
            </span>
            <span
              className="font-medium uppercase text-[#94A3B8]"
              style={{ fontSize: 11, letterSpacing: "0.24em", lineHeight: 1 }}
            >
              Nervous System For Autonomous Agents
            </span>
          </div>
          {/* Row 2: subtitle under AXONETIS */}
          <span
            className="mt-1.5 whitespace-nowrap font-medium uppercase text-[#CBD5E1]"
            style={{ fontSize: 8, letterSpacing: "0.14em" }}
          >
            Advance AI OS Builder
          </span>
        </div>
      </div>

      {/* CENTER — context selectors */}
      <div className="flex flex-1 items-center justify-center gap-2">
        <Selector label={active.name} accent={active.accent}>
          {PROJECTS.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => setProject(p.id as ProjectId)} className="gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.accent }} />
              <span className="flex-1">{p.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                {supabaseLabelFor(p.id as ProjectId)}
              </span>
            </DropdownMenuItem>
          ))}
        </Selector>

        <Selector label={branch} mono>
          {BRANCHES.map((b) => (
            <DropdownMenuItem key={b} onClick={() => setBranch(b as Branch)} className="font-mono text-xs">
              {b}
            </DropdownMenuItem>
          ))}
        </Selector>

        <Selector label={environment} pill={envDot(environment)}>
          {ENVIRONMENTS.map((e) => (
            <DropdownMenuItem key={e} onClick={() => setEnvironment(e as Environment)} className="gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${envDot(e)}`} />
              {e}
            </DropdownMenuItem>
          ))}
        </Selector>
      </div>

      {/* RIGHT — Quick actions / Publish / User */}
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-xs text-muted-foreground transition-colors hover:border-white/[0.18] hover:bg-white/[0.04] hover:text-foreground md:flex"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Quick actions</span>
          <kbd className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        <Button
          size="sm"
          onClick={() => setPublishOpen(true)}
          className="fb-pulse h-10 gap-2 rounded-lg bg-gradient-to-r from-[#E50914] via-[#cc0812] to-[#7c0610] px-5 text-[13px] font-semibold uppercase tracking-wider text-white shadow-[0_8px_30px_-8px_rgba(229,9,20,0.55)] hover:from-[#ff1521] hover:to-[#E50914]"
        >
          <Rocket className="h-3.5 w-3.5" />
          Publish
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.02] transition-colors hover:bg-white/[0.05]">
              <User className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-red-400 focus:text-red-300">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />
    </motion.header>
  );
}

function Selector({
  label, children, accent, mono, pill,
}: { label: string; children: React.ReactNode; accent?: string; mono?: boolean; pill?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 text-[13px] transition-colors hover:border-white/[0.18] hover:bg-white/[0.05]">
          {accent && <span className="inline-block h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />}
          {pill && <span className={`inline-block h-2 w-2 rounded-full ${pill}`} />}
          <span className={mono ? "font-mono" : "font-medium"}>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function envDot(env: string) {
  return env === "Production" ? "bg-red-500" : env === "Staging" ? "bg-amber-400" : "bg-emerald-400";
}
