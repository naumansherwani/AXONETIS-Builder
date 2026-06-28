/**
 * Generic panel for rail items that don't have a bespoke surface yet.
 * Honest "not wired yet" — no fake phase progress badges.
 */
import type { LucideIcon } from "lucide-react";

export default function GenericPanel({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="mb-1 text-[14px] font-semibold text-foreground/95">{title}</div>
      <div className="mb-4 max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">{hint}</div>
      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Not wired yet
      </span>
    </div>
  );
}
