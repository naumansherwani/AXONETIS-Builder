/**
 * ChatScrollRail — custom vertical scrollbar for the chat messages list.
 * Sits on the LEFT edge of the scroll container. Red glowing thumb with
 * chevron up/down buttons. Drag to scroll, click track to jump.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  /** The scrollable element this rail controls. */
  targetRef: React.RefObject<HTMLDivElement | null>;
  /** Recompute trigger — pass something that changes when content grows (e.g. messages.length). */
  contentKey?: unknown;
}

const MIN_THUMB = 36;
const STEP = 240;

export default function ChatScrollRail({ targetRef, contentKey }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(MIN_THUMB);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);

  const recompute = useCallback(() => {
    const el = targetRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const trackH = track.clientHeight;
    const ratio = el.clientHeight / Math.max(el.scrollHeight, 1);
    const th = Math.max(MIN_THUMB, Math.floor(trackH * ratio));
    const maxScroll = Math.max(el.scrollHeight - el.clientHeight, 1);
    const progress = el.scrollTop / maxScroll;
    const top = Math.floor((trackH - th) * progress);
    setThumbHeight(th);
    setThumbTop(top);
    setVisible(el.scrollHeight > el.clientHeight + 4);
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    recompute();
    const onScroll = () => recompute();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [targetRef, recompute]);

  useEffect(() => {
    recompute();
  }, [contentKey, recompute]);

  // Drag thumb
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const el = targetRef.current;
      const track = trackRef.current;
      if (!el || !track) return;
      const rect = track.getBoundingClientRect();
      const y = e.clientY - rect.top - thumbHeight / 2;
      const clamped = Math.max(0, Math.min(rect.height - thumbHeight, y));
      const maxScroll = el.scrollHeight - el.clientHeight;
      const progress = clamped / Math.max(rect.height - thumbHeight, 1);
      el.scrollTop = maxScroll * progress;
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, thumbHeight, targetRef]);

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = targetRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    if ((e.target as HTMLElement).dataset.role === "thumb") return;
    const rect = track.getBoundingClientRect();
    const y = e.clientY - rect.top - thumbHeight / 2;
    const clamped = Math.max(0, Math.min(rect.height - thumbHeight, y));
    const maxScroll = el.scrollHeight - el.clientHeight;
    const progress = clamped / Math.max(rect.height - thumbHeight, 1);
    el.scrollTo({ top: maxScroll * progress, behavior: "smooth" });
  };

  const step = (dir: -1 | 1) => {
    targetRef.current?.scrollBy({ top: dir * STEP, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <div
      aria-hidden={false}
      className="pointer-events-none absolute inset-y-2 left-1.5 z-30 flex w-4 flex-col items-center gap-1"
    >
      {/* Up chevron */}
      <button
        type="button"
        title="Scroll up"
        onClick={() => step(-1)}
        className="pointer-events-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#E50914]/30 bg-black/50 text-[#ff6b73] shadow-[0_0_10px_-2px_rgba(229,9,20,0.6)] backdrop-blur-md transition-all hover:border-[#E50914]/60 hover:bg-[#E50914]/15 hover:text-white hover:shadow-[0_0_14px_-1px_rgba(229,9,20,0.9)] active:scale-95"
      >
        <ChevronUp className="h-3 w-3" />
      </button>

      {/* Track */}
      <div
        ref={trackRef}
        onClick={onTrackClick}
        className="pointer-events-auto relative min-h-0 w-[3px] flex-1 cursor-pointer overflow-visible rounded-full bg-gradient-to-b from-white/[0.04] via-[#E50914]/[0.08] to-white/[0.04]"
      >
        {/* Glowing spine line */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-[#E50914]/0 via-[#E50914]/40 to-[#E50914]/0"
        />

        {/* Thumb */}
        <div
          data-role="thumb"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            setDragging(true);
          }}
          style={{
            top: `${thumbTop}px`,
            height: `${thumbHeight}px`,
          }}
          className={`absolute left-1/2 w-[10px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#ff3b47] via-[#E50914] to-[#a80710] shadow-[0_0_14px_rgba(229,9,20,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-[#E50914]/40 transition-[width,box-shadow] ${
            dragging
              ? "w-[14px] shadow-[0_0_22px_rgba(229,9,20,0.95),inset_0_1px_0_rgba(255,255,255,0.5)]"
              : "hover:w-[12px] hover:shadow-[0_0_18px_rgba(229,9,20,0.85),inset_0_1px_0_rgba(255,255,255,0.45)]"
          }`}
        >
          {/* Inner highlight pill */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-[2px] top-1 h-1/3 rounded-full bg-white/25 blur-[1px]"
          />
          {/* Grip dots */}
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 space-y-[2px]">
            <span className="block h-[2px] w-[2px] rounded-full bg-white/80" />
            <span className="block h-[2px] w-[2px] rounded-full bg-white/80" />
            <span className="block h-[2px] w-[2px] rounded-full bg-white/80" />
          </span>
        </div>
      </div>

      {/* Down chevron */}
      <button
        type="button"
        title="Scroll down"
        onClick={() => step(1)}
        className="pointer-events-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#E50914]/30 bg-black/50 text-[#ff6b73] shadow-[0_0_10px_-2px_rgba(229,9,20,0.6)] backdrop-blur-md transition-all hover:border-[#E50914]/60 hover:bg-[#E50914]/15 hover:text-white hover:shadow-[0_0_14px_-1px_rgba(229,9,20,0.9)] active:scale-95"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}
