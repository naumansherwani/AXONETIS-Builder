import { useNavigate } from "@tanstack/react-router";
import { Boxes, Database, GitBranch, LogOut, Rocket, ScrollText, Terminal, Users } from "lucide-react";
import { useBuilder, type BottomTabId } from "@/lib/builder-state";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { PROJECTS, type ProjectId } from "@/lib/projects";
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

export default function CommandPalette() {
  const navigate = useNavigate();
  const { paletteOpen, setPaletteOpen, setProject, setBottomTab } = useBuilder();

  const run = (fn: () => void) => { fn(); setPaletteOpen(false); };

  async function handleSignOut() {
    if (SUPABASE3_READY) await supabase3.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const tabs: { id: BottomTabId; label: string; icon: typeof Database }[] = [
    { id: "database", label: "Database", icon: Database },
    { id: "agents",   label: "Agents",   icon: Users },
    { id: "runtime",  label: "Runtime",  icon: Boxes },
    { id: "git",      label: "Git",      icon: GitBranch },
    { id: "logs",     label: "Logs",     icon: ScrollText },
    { id: "deploy",   label: "Deploy",   icon: Rocket },
    { id: "terminal", label: "Terminal", icon: Terminal },
  ];

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Type a command, switch project, open a tab…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Switch project">
          {PROJECTS.map((p) => (
            <CommandItem key={p.id} onSelect={() => run(() => setProject(p.id as ProjectId))}>
              <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: p.accent }} />
              {p.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Open tab">
          {tabs.map((t) => (
            <CommandItem key={t.id} onSelect={() => run(() => setBottomTab(t.id))}>
              <t.icon className="mr-2 h-4 w-4 text-[#ff6b73]" />
              {t.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => alert("Phase 2 wires Publish."))}>
            <Rocket className="mr-2 h-4 w-4 text-[#ff6b73]" />
            Publish to Production
          </CommandItem>
          <CommandItem onSelect={() => run(handleSignOut)}>
            <LogOut className="mr-2 h-4 w-4 text-red-400" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
