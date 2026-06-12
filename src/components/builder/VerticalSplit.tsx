/**
 * Vertical resizable splitter for the center column (Preview top / Chat bottom).
 * Pure CSS + pointer events — no extra dep.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  top: ReactNode;
  bottom: ReactNode;
  /** Initial top-flex ratio (0..1). Persisted in localStorage. */
  initial?: number;
  storageKey?: string;
  minTopPct?: number;
  minBottomPct?: number;
}

export default function VerticalSplit({
  top,
  bottom,
  initial = 0.62,
  storageKey = "axonetis.center.split.v1",
  minTopPct = 25,
  minBottomPct = 20,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [topPct, setTopPct] = useState<number>(() => {
    if (typeof window === "undefined") return initial * 100;
    const s = localStorage.getItem(storageKey);
    const v = s ? Number(s) : initial * 100;
    return Number.isFinite(v) ? clamp(v, minTopPct, 100 - minBottomPct) : initial * 100;
  });

  const onMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setTopPct(clamp(pct, minTopPct, 100 - minBottomPct));
    },
    [minBottomPct, minTopPct],
  );

  const stop = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try { localStorage.setItem(storageKey, String(topPct)); } catch { /* noop */ }
  }, [storageKey, topPct]);

  useEffect(() => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [onMove, stop]);

  return (
    <div ref={containerRef} className="relative flex h-full min-h-0 w-full flex-col">
      <div className="min-h-0 overflow-hidden" style={{ flexBasis: `${topPct}%` }}>
        {top}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          draggingRef.current = true;
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
        }}
        className="group relative z-10 h-[6px] shrink-0 cursor-row-resize bg-transparent"
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.08] transition-colors group-hover:bg-[#E50914]/60" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.08] transition-colors group-hover:bg-[#E50914]/60" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{bottom}</div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
