import { useNavigate } from "@tanstack/react-router";
import {
  Boxes,
  Database,
  GitBranch,
  LogOut,
  Monitor,
  Rocket,
  ScrollText,
  Terminal,
  Files as FilesIcon,
  Compass,
} from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { PROJECTS, type ProjectId } from "@/lib/projects";
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";
import type { TabKind } from "./workspace/tab-registry";

const TABS: { id: TabKind; label: string; icon: typeof Database }[] = [
  { id: "preview", label: "Preview", icon: Monitor },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "github", label: "GitHub", icon: GitBranch },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "database", label: "Database", icon: Database },
  { id: "runtime", label: "Runtime", icon: Boxes },
  { id: "files", label: "Files", icon: FilesIcon },
  { id: "command", label: "Command", icon: Compass },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const { paletteOpen, setPaletteOpen, setProject } = useBuilder();

  const run = (fn: () => void) => {
    fn();
    setPaletteOpen(false);
  };

  const openTab = (id: TabKind) => {
    const fn = (window as unknown as { axonetisOpenTab?: (k: TabKind) => void }).axonetisOpenTab;
    if (fn) fn(id);
  };

  async function handleSignOut() {
    if (SUPABASE3_READY) await supabase3.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Type a command, switch project, open a tab…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Switch project">
          {PROJECTS.map((p) => (
            <CommandItem key={p.id} onSelect={() => run(() => setProject(p.id as ProjectId))}>
              <span
                className="mr-2 inline-block h-2 w-2 rounded-full"
                style={{ background: p.accent }}
              />
              {p.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Open tab">
          {TABS.map((t) => (
            <CommandItem key={t.id} onSelect={() => run(() => openTab(t.id))}>
              <t.icon className="mr-2 h-4 w-4 text-[#ff6b73]" />
              {t.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => alert("Phase B wires Publish."))}>
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
