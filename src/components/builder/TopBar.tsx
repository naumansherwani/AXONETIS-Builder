import { useEffect } from "react";
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
import AxonMark from "./logo-lab/AxonMark";

export default function TopBar() {
  const navigate = useNavigate();
  const { project, branch, environment, agentState, setProject, setBranch, setEnvironment, setPaletteOpen, setAgentState } = useBuilder();
  const active = PROJECTS.find((p) => p.id === project)!;

  // Founder demo: Alt+1 standby · Alt+2 Jimmy · Alt+3 Sherlock
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
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/80 px-3 backdrop-blur-xl"
    >
      {/* LEFT: Logo (FAB) + selectors */}
      <div className="flex items-center gap-2">
        <div className="mr-2 flex items-center gap-3">
          <AxonMark state={agentState} size={22} wordmark />
          <span className="hidden text-[9px] font-medium uppercase tracking-[0.35em] text-muted-foreground/80 lg:inline">
            Nervous system for autonomous agents
          </span>
        </div>


        <Selector label={active.name} accent={active.accent}>
          {PROJECTS.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => setProject(p.id as ProjectId)} className="gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.accent }} />
              {p.name}
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

        <Selector label={environment} pill={envPill(environment)}>
          {ENVIRONMENTS.map((e) => (
            <DropdownMenuItem key={e} onClick={() => setEnvironment(e as Environment)} className="gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${envDot(e)}`} />
              {e}
            </DropdownMenuItem>
          ))}
        </Selector>
      </div>

      {/* RIGHT: ⌘K, Publish, User */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-xs text-muted-foreground transition-colors hover:border-white/[0.16] hover:text-foreground md:flex"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Quick actions</span>
          <kbd className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        <Button size="sm" className="fb-pulse h-8 gap-1.5 bg-gradient-to-r from-[#E50914] to-[#b3070f] px-3 text-xs font-medium text-white hover:from-[#E50914] hover:to-[#E50914]">
          <Rocket className="h-3.5 w-3.5" />
          Publish
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.08] bg-white/[0.02] transition-colors hover:bg-white/[0.05]">
              <User className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-red-400 focus:text-red-300">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}

function Selector({
  label, children, accent, mono, pill,
}: { label: string; children: React.ReactNode; accent?: string; mono?: boolean; pill?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-xs transition-colors hover:border-white/[0.16] hover:bg-white/[0.05]">
          {accent && <span className="inline-block h-2 w-2 rounded-full" style={{ background: accent }} />}
          {pill && <span className={`inline-block h-2 w-2 rounded-full ${pill}`} />}
          <span className={mono ? "font-mono" : "font-medium"}>{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function envPill(env: Environment) {
  return env === "Production" ? "bg-red-500" : env === "Staging" ? "bg-amber-400" : "bg-emerald-400";
}
function envDot(env: string) {
  return env === "Production" ? "bg-red-500" : env === "Staging" ? "bg-amber-400" : "bg-emerald-400";
}
