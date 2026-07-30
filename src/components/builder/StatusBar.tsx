import { useBuilder } from "@/lib/builder-state";
import { PROJECTS } from "@/lib/projects";
import { SUPABASE3_READY } from "@/integrations/supabase3/client";

export default function StatusBar() {
  const { project, branch, environment, bridgeStatus } = useBuilder();
  const active = PROJECTS.find((p) => p.id === project)!;

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-white/[0.06] bg-background px-3 text-[10px] uppercase tracking-widest text-muted-foreground">
      {/* LEFT: real signals only */}
      <div className="flex items-center gap-4">
        <StatusItem
          label="DB"
          value={SUPABASE3_READY ? "Connected" : "Not configured"}
          tone={SUPABASE3_READY ? "emerald" : "gray"}
        />
        <StatusItem
          label="Bridge"
          value={bridgeStatus}
          tone={
            bridgeStatus === "connected"
              ? "emerald"
              : bridgeStatus === "no-signal"
                ? "amber"
                : "gray"
          }
          pulse={bridgeStatus === "handshaking"}
        />
      </div>

      {/* RIGHT: project context (no fake metrics) */}
      <div className="flex items-center gap-4">
        <span className="font-mono text-muted-foreground/70">
          {active.shortName} · {branch} · {environment}
        </span>
      </div>
    </div>
  );
}

function StatusItem({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: string;
  tone: "red" | "emerald" | "amber" | "gray";
  pulse?: boolean;
}) {
  const color =
    tone === "red"
      ? "bg-red-500"
      : tone === "emerald"
        ? "bg-emerald-400"
        : tone === "amber"
          ? "bg-amber-400"
          : "bg-muted-foreground";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color} ${pulse ? "fb-blink" : ""}`} />
      <span>
        {label}: <span className="text-foreground/90">{value}</span>
      </span>
    </span>
  );
}
