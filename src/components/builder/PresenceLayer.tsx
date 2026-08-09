/**
 * Phase 10.5 — Multiplayer presence overlay.
 * Live colored cursors + name labels, selection highlight ghosts, and the
 * avatar list rendered top-right of the preview surface.
 *
 * Mounted inside LivePreview (absolute, pointer-events-none) so cursor
 * coordinates are normalized against the same surface for every peer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useBuilder } from "@/lib/builder-state";
import {
  initials,
  joinPresence,
  type ActivityEvent,
  type PresenceHandle,
  type PresencePeer,
} from "@/lib/presence-api";

const ACTIVITY_BUS = "axonetis:presence:activity";

/** Broadcast helper so other components (Files, Chat) can publish activity. */
export function emitLocalActivity(text: string, actor?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACTIVITY_BUS, { detail: { text, actor } }));
}

export default function PresenceLayer() {
  const { project } = useBuilder();
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const handleRef = useRef<PresenceHandle | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = joinPresence(
      project,
      { name: "Founder", kind: "human" },
      {
        onPeers: setPeers,
        onActivity: (ev: ActivityEvent) => {
          window.dispatchEvent(new CustomEvent("axonetis:presence:feed", { detail: ev }));
        },
      },
    );
    handleRef.current = handle;

    const onMove = (e: MouseEvent) => {
      const box = surfaceRef.current?.parentElement?.getBoundingClientRect();
      if (!box || box.width === 0) return;
      const x = (e.clientX - box.left) / box.width;
      const y = (e.clientY - box.top) / box.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      handle.moveCursor(x, y);
    };
    const onSelect = () => {
      const text = window.getSelection()?.toString() ?? "";
      handle.setSelection(text.trim() ? text.trim().slice(0, 120) : null);
    };
    const onActivity = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; actor?: string }>).detail;
      if (d?.text) handle.publishActivity(d.text, d.actor);
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("selectionchange", onSelect);
    window.addEventListener(ACTIVITY_BUS, onActivity);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("selectionchange", onSelect);
      window.removeEventListener(ACTIVITY_BUS, onActivity);
      handle.close();
      handleRef.current = null;
    };
  }, [project]);

  const visible = useMemo(() => peers.filter((p) => Date.now() - p.at < 45_000), [peers]);

  return (
    <div ref={surfaceRef} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {/* avatar list — top-right of preview */}
      {visible.length > 0 && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-1.5 py-1 backdrop-blur-md">
          {visible.slice(0, 6).map((p) => (
            <span
              key={p.id}
              title={`${p.name} · ${p.kind}`}
              className="grid h-6 w-6 place-items-center rounded-full font-mono text-[9px] font-bold text-black"
              style={{ background: p.color, boxShadow: `0 0 14px -3px ${p.color}` }}
            >
              {initials(p.name) || "?"}
            </span>
          ))}
          {visible.length > 6 && (
            <span className="px-1 text-[10px] text-muted-foreground">+{visible.length - 6}</span>
          )}
        </div>
      )}

      {/* cursors + selection ghosts */}
      {visible.map((p) => (
        <div
          key={`c_${p.id}`}
          className="absolute transition-[left,top] duration-100 ease-linear"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
            <path d="M1 1l11 6.5-4.6 1.2L9 15.5 1 1z" fill={p.color} stroke="#000" strokeWidth="0.8" />
          </svg>
          <span
            className="ml-2 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[9.5px] font-semibold text-black"
            style={{ background: p.color }}
          >
            {p.name}
          </span>
          {p.selection && (
            <span
              className="mt-1 block max-w-[180px] truncate rounded px-1.5 py-0.5 text-[9px] text-white/90"
              style={{ background: `${p.color}40`, border: `1px solid ${p.color}` }}
            >
              “{p.selection}”
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
