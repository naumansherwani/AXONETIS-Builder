/**
 * Horizontal resizable splitter for the final Lovable-style workspace.
 * Left = Unified Build Chat, Right = Live Preview iframe.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

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

  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div ref={containerRef} className="relative flex h-full min-h-0 w-full min-w-0">
      <div className="min-h-0 min-w-0 overflow-hidden pr-2" style={{ flexBasis: `${leftPct}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat and preview"
        className="relative z-10 w-[8px] shrink-0 bg-transparent"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/[0.12]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/[0.12]" />
        <button
          type="button"
          aria-label="Drag to resize chat and preview"
          onPointerDown={startDrag}
          onDoubleClick={() => setLeftPct(initial * 100)}
          className="group absolute left-1/2 top-1/2 grid h-12 w-5 -translate-x-1/2 -translate-y-1/2 cursor-col-resize place-items-center rounded-full border border-white/[0.08] bg-[#07070b]/95 text-muted-foreground shadow-[0_0_18px_rgba(0,0,0,0.55)] transition-colors hover:border-[#E50914]/50 hover:bg-[#E50914]/15 hover:text-[#ff7480]"
          title="Resize preview"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}