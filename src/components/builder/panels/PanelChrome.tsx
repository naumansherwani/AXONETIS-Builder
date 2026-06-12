/**
 * Shared chrome for every side-drawer panel.
 * Premium dark glass, vertical scroll, subtle border, section accents.
 */
import type { ReactNode } from "react";

export function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
          {title}
        </h4>
        {action}
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-2">
        {children}
      </div>
    </section>
  );
}

export function Row({
  left,
  right,
  active,
  onClick,
}: {
  left: ReactNode;
  right?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
        active
          ? "bg-[#E50914]/12 text-[#ff7480]"
          : "text-foreground/80 hover:bg-white/[0.04] hover:text-foreground"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">{left}</span>
      {right && <span className="shrink-0 text-[10px] text-muted-foreground/70">{right}</span>}
    </button>
  );
}

export function Dot({ tone }: { tone: "red" | "amber" | "emerald" | "violet" | "sky" | "gray" }) {
  const map: Record<string, string> = {
    red: "bg-[#E50914] shadow-[0_0_8px_#E50914]",
    amber: "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
    emerald: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
    violet: "bg-[#a855f7] shadow-[0_0_8px_#a855f7]",
    sky: "bg-sky-400 shadow-[0_0_8px_#38bdf8]",
    gray: "bg-muted-foreground/60",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${map[tone]}`} />;
}
