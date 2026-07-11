/**
 * Phase 3.9.4 — rrweb session recorder.
 * Records the builder UI (same-origin), batches events, ships to Hetzner
 * `/rpc/rrweb.push` every 5s. Cross-origin iframe events are captured
 * separately via preview-bridge. NO DUPLICATE — single global recorder.
 */
import { useEffect, useRef } from "react";
import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import { pushRrwebBatch } from "./power-tools-api";

const FLUSH_MS = 5000;
const MAX_BUFFER = 500;

let started = false;

export function useRrwebRecorder(projectId: string, enabled = true) {
  const buf = useRef<eventWithTime[]>([]);
  const sessionId = useRef<string>(cryptoRandomId());
  const flushT = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopFn = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || started) return;
    started = true;

    const flush = async () => {
      if (buf.current.length === 0) return;
      const batch = buf.current.splice(0, buf.current.length);
      await pushRrwebBatch(projectId, sessionId.current, batch);
    };

    try {
      stopFn.current = record({
        emit(event) {
          buf.current.push(event as eventWithTime);
          if (buf.current.length >= MAX_BUFFER) void flush();
        },
        sampling: { mousemove: 100, scroll: 200, input: "last" },
        recordCanvas: false,
        collectFonts: false,
      }) ?? null;
    } catch {
      // rrweb init failed — silent
    }

    flushT.current = setInterval(() => { void flush(); }, FLUSH_MS);

    const onUnload = () => {
      // best-effort final flush
      void flush();
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      if (flushT.current) clearInterval(flushT.current);
      stopFn.current?.();
      started = false;
    };
  }, [projectId, enabled]);
}

function cryptoRandomId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
