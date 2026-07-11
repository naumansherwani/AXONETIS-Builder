/**
 * ChatScrollRail — compact vertical scrollbar for the chat messages list.
 * Sits on the LEFT edge. Subtle dark thumb + tiny chevron up/down carets.
 * Matches the reference: dark rounded thumb with a small triangle below.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  /** The scrollable element this rail controls. */
  targetRef: React.RefObject<HTMLDivElement | null>;
  /** Recompute trigger — pass something that changes when content grows. */
  contentKey?: unknown;
}

const MIN_THUMB = 28;
const STEP = 240;

export default function ChatScrollRail({ targetRef, contentKey }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(MIN_THUMB);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

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
    setAtTop(el.scrollTop <= 1);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
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
      className="pointer-events-none absolute inset-y-2 left-1 z-30 flex w-3 flex-col items-center gap-1"
    >
      {/* Up caret — tiny triangle */}
      <button
        type="button"
        title="Scroll up"
        onClick={() => step(-1)}
        disabled={atTop}
        className="pointer-events-auto grid h-3 w-3 shrink-0 place-items-center text-white/40 transition hover:text-white disabled:opacity-25"
      >
        <svg viewBox="0 0 8 6" className="h-[6px] w-[8px] fill-current">
          <path d="M4 0 L8 6 L0 6 Z" />
        </svg>
      </button>

      {/* Track — cinematic red glowing vertical line */}
      <div
        ref={trackRef}
        onClick={onTrackClick}
        className="pointer-events-auto relative min-h-0 w-[2px] flex-1 cursor-pointer rounded-full bg-gradient-to-b from-[#E50914]/70 via-[#E50914] to-[#E50914]/70 shadow-[0_0_8px_rgba(229,9,20,0.75),0_0_16px_rgba(229,9,20,0.45)]"
      >
        {/* Thumb — small dark pill riding the glow */}
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
          className={`absolute left-1/2 -translate-x-1/2 rounded-[3px] border border-white/15 bg-[#0a0a0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(0,0,0,0.7),0_0_10px_rgba(229,9,20,0.35)] transition-[width,box-shadow] ${
            dragging ? "w-[9px]" : "w-[7px] hover:w-[8px]"
          }`}
        />
      </div>

      {/* Down caret — tiny triangle */}
      <button
        type="button"
        title="Scroll down"
        onClick={() => step(1)}
        disabled={atBottom}
        className="pointer-events-auto grid h-3 w-3 shrink-0 place-items-center text-white/40 transition hover:text-white disabled:opacity-25"
      >
        <svg viewBox="0 0 8 6" className="h-[6px] w-[8px] fill-current">
          <path d="M0 0 L8 0 L4 6 Z" />
        </svg>
      </button>
    </div>
  );
}
