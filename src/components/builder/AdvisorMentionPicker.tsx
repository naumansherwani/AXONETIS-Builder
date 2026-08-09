/**
 * Phase 10.12 — Industry Advisor @mention picker.
 * Rendered above the composer when the caret sits on an `@…` token.
 */
import { useEffect, useState } from "react";
import { ADVISORS, filterAdvisors, type Advisor } from "@/lib/advisors-api";

export default function AdvisorMentionPicker({
  query,
  onPick,
  onClose,
}: {
  query: string;
  onPick: (advisor: Advisor) => void;
  onClose: () => void;
}) {
  const list = filterAdvisors(query);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (list.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => (i + 1) % list.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => (i - 1 + list.length) % list.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onPick(list[index]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, list, onClose, onPick]);

  if (list.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-40 mb-2 w-[290px] overflow-hidden rounded-lg border border-white/10 bg-[#0b0b11]/97 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="border-b border-white/[0.06] px-2.5 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
        Industry advisors · {ADVISORS.length}
      </div>
      <ul className="max-h-[240px] overflow-y-auto py-1">
        {list.map((a, i) => (
          <li key={a.slug}>
            <button
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => onPick(a)}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left ${
                i === index ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
              }`}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold text-black"
                style={{ background: a.color, boxShadow: `0 0 14px -4px ${a.color}` }}
              >
                {a.glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[11.5px] font-medium text-foreground/95">@{a.slug}</span>
                  <span
                    className="rounded border px-1 py-[1px] text-[8.5px] font-semibold uppercase tracking-wider"
                    style={{ color: a.color, borderColor: `${a.color}55`, background: `${a.color}14` }}
                  >
                    {a.domain}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {a.tagline}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Chat-bubble avatar + domain badge for a routed advisor answer. */
export function AdvisorBadge({ advisor, thinking }: { advisor: Advisor; thinking?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="grid h-5 w-5 place-items-center rounded-full font-mono text-[9px] font-bold text-black"
        style={{ background: advisor.color, boxShadow: `0 0 12px -3px ${advisor.color}` }}
      >
        {advisor.glyph}
      </span>
      <span className="text-[10.5px] font-semibold" style={{ color: advisor.color }}>
        {advisor.name}
      </span>
      <span
        className="rounded border px-1 py-[1px] text-[8.5px] font-semibold uppercase tracking-wider"
        style={{
          color: advisor.color,
          borderColor: `${advisor.color}55`,
          background: `${advisor.color}14`,
        }}
      >
        {advisor.domain}
      </span>
      {thinking && (
        <span className="ml-1 animate-pulse text-[10px] text-muted-foreground">
          {advisor.name} is analyzing…
        </span>
      )}
    </span>
  );
}
