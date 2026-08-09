/**
 * Phase 10.5 — Multiplayer presence client (Supabase 3 Realtime).
 * Channel: presence:project:{projectId}
 *
 * - Broadcasts local cursor position (throttled) + selection range.
 * - Tracks presence state for the avatar list.
 * - Broadcasts activity events ("Jimmy edited Button.tsx") on an `activity` event.
 *
 * NO DUPLICATE: uses the existing lazy Supabase 3 client (integrations/supabase3).
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

export interface PresencePeer {
  id: string;
  name: string;
  color: string;
  kind: "human" | "agent";
  /** normalized 0..1 relative to the preview surface */
  x: number;
  y: number;
  selection: string | null;
  at: number;
}

export interface ActivityEvent {
  id: string;
  actor: string;
  color: string;
  text: string;
  at: number;
}

const PEER_COLORS = [
  "#E50914",
  "#a855f7",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#60a5fa",
  "#fb923c",
];

export function peerColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PEER_COLORS[Math.abs(h) % PEER_COLORS.length];
}

export function presenceChannelName(projectId: string): string {
  return `presence:project:${projectId}`;
}

export function localPeerId(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "axonetis.presence.peer";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export interface PresenceHandlers {
  onPeers: (peers: PresencePeer[]) => void;
  onActivity: (ev: ActivityEvent) => void;
}

export interface PresenceHandle {
  /** normalized coordinates */
  moveCursor: (x: number, y: number) => void;
  setSelection: (text: string | null) => void;
  publishActivity: (text: string, actor?: string) => void;
  close: () => void;
  ready: boolean;
}

const NOOP: PresenceHandle = {
  moveCursor: () => {},
  setSelection: () => {},
  publishActivity: () => {},
  close: () => {},
  ready: false,
};

export function joinPresence(
  projectId: string,
  me: { name: string; kind: "human" | "agent" },
  handlers: PresenceHandlers,
): PresenceHandle {
  if (!SUPABASE3_READY || typeof window === "undefined") return NOOP;

  const id = localPeerId();
  const color = peerColor(id);
  let channel: RealtimeChannel;
  try {
    channel = getSupabase3().channel(presenceChannelName(projectId), {
      config: { presence: { key: id } },
    });
  } catch {
    return NOOP;
  }

  let state: PresencePeer = {
    id,
    name: me.name,
    color,
    kind: me.kind,
    x: 0.5,
    y: 0.5,
    selection: null,
    at: Date.now(),
  };

  const emitPeers = () => {
    const raw = channel.presenceState<PresencePeer>();
    const peers: PresencePeer[] = [];
    for (const key of Object.keys(raw)) {
      const entry = raw[key]?.[0];
      if (entry && entry.id !== id) peers.push(entry);
    }
    handlers.onPeers(peers.sort((a, b) => a.name.localeCompare(b.name)));
  };

  channel
    .on("presence", { event: "sync" }, emitPeers)
    .on("presence", { event: "join" }, emitPeers)
    .on("presence", { event: "leave" }, emitPeers)
    .on("broadcast", { event: "activity" }, ({ payload }) => {
      const p = payload as Partial<ActivityEvent>;
      if (!p?.text) return;
      handlers.onActivity({
        id: p.id ?? `a_${Date.now()}`,
        actor: p.actor ?? "someone",
        color: p.color ?? "#a855f7",
        text: p.text,
        at: p.at ?? Date.now(),
      });
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void channel.track(state);
    });

  let lastTrack = 0;
  let pending: number | null = null;
  const track = () => {
    lastTrack = Date.now();
    void channel.track({ ...state, at: lastTrack });
  };
  const throttledTrack = () => {
    const since = Date.now() - lastTrack;
    if (since >= 80) {
      if (pending) {
        window.clearTimeout(pending);
        pending = null;
      }
      track();
    } else if (!pending) {
      pending = window.setTimeout(() => {
        pending = null;
        track();
      }, 80 - since);
    }
  };

  return {
    ready: true,
    moveCursor(x, y) {
      state = { ...state, x, y };
      throttledTrack();
    },
    setSelection(text) {
      state = { ...state, selection: text };
      throttledTrack();
    },
    publishActivity(text, actor) {
      const ev: ActivityEvent = {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        actor: actor ?? me.name,
        color,
        text,
        at: Date.now(),
      };
      void channel.send({ type: "broadcast", event: "activity", payload: ev });
      handlers.onActivity(ev);
    },
    close() {
      if (pending) window.clearTimeout(pending);
      try {
        void channel.unsubscribe();
      } catch {
        /* noop */
      }
    },
  };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function relativeTime(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
