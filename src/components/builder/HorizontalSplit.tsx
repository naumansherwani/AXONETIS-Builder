/**
 * Horizontal resizable splitter for the final Lovable-style workspace.
 * Left = Unified Build Chat, Right = Live Preview iframe.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  left: ReactNode;
  right: ReactNode;
  initial?: number;
  storageKey?: string;
  minLeftPct?: number;
  minRightPct?: number;
}

export default function HorizontalSplit({
  left,
  right,
  initial = 0.4,
  storageKey = "axonetis.workspace.split.v2",
  minLeftPct = 25,
  minRightPct = 30,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [leftPct, setLeftPct] = useState(() => {
    if (typeof window === "undefined") return initial * 100;
    const stored = localStorage.getItem(storageKey);
    const value = stored ? Number(stored) : initial * 100;
    return Number.isFinite(value) ? clamp(value, minLeftPct, 100 - minRightPct) : initial * 100;
  });

  const onMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(clamp(pct, minLeftPct, 100 - minRightPct));
    },
    [minLeftPct, minRightPct],
  );

  const stop = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try { localStorage.setItem(storageKey, String(leftPct)); } catch { /* noop */ }
  }, [leftPct, storageKey]);

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
    <div ref={containerRef} className="relative flex h-full min-h-0 w-full min-w-0">
      <div className="min-h-0 min-w-0 overflow-hidden" style={{ flexBasis: `${leftPct}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          draggingRef.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        className="group relative z-10 w-[10px] shrink-0 cursor-col-resize bg-transparent hover:bg-[#E50914]/15 transition-colors"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/[0.12]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/[0.12]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 shadow-[0_0_12px_rgba(229,9,20,0.5)] transition-all group-hover:bg-[#E50914] group-hover:shadow-[0_0_22px_rgba(229,9,20,0.95)]" />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}