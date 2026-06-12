/**
 * Generic panel for tabs that don't have a bespoke surface yet.
 * Renders a clean "Phase 3+ wire" placeholder instead of a dead area.
 */
import type { LucideIcon } from "lucide-react";

export default function GenericPanel({
  icon: Icon,
  title,
  hint,
  phase = "Phase 3",
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  phase?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] shadow-[0_0_30px_-10px_rgba(229,9,20,0.45)]">
        <Icon className="h-6 w-6 text-[#ff7480]" />
      </div>
      <div className="mb-1 text-[14px] font-semibold text-foreground/95">{title}</div>
      <div className="mb-4 max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">{hint}</div>
      <span className="rounded-full border border-[#E50914]/30 bg-[#E50914]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#ff7480]">
        {phase} · in progress
      </span>
    </div>
  );
}
