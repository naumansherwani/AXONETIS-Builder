/**
 * AXONETIS Phase 3.9.5 — Agent run cancel registry (LOCKED)
 *
 * COPY-PASTE TARGET: /root/axonetis-builder/src/workers/agents.cancel.ts
 *
 * Central AbortController registry keyed by user messageId (source of truth
 * for a single agent run — Jimmy loop, Sherlock audit, tool call, etc.).
 *
 * Contract:
 *   register(messageId)  → AbortController (throws if already exists)
 *   signalFor(messageId) → AbortSignal | undefined  (worker passes into streamText/generateText)
 *   cancel(messageId, reason?) → boolean            (route handler calls; true if aborted)
 *   release(messageId)   → void                     (worker calls in finally, always)
 *   isCancelled(messageId) → boolean
 *
 * Zero deps. Safe to import from routes AND worker (same Node process,
 * PM2 axonetis-builder, single instance — LOCKED per PM2 memory).
 */
type Entry = { controller: AbortController; startedAt: number };

const registry = new Map<string, Entry>();

/** Max concurrent runs before we start GC'ing the oldest — safety net. */
const HARD_CAP = 500;

export function registerRun(messageId: string): AbortController {
  if (!messageId) throw new Error("cancel.register: messageId required");
  const existing = registry.get(messageId);
  if (existing) return existing.controller; // idempotent — retries reuse same controller
  if (registry.size >= HARD_CAP) {
    // Evict oldest to avoid unbounded growth if some worker forgot release().
    let oldestKey: string | null = null;
    let oldestT = Infinity;
    for (const [k, v] of registry) if (v.startedAt < oldestT) { oldestT = v.startedAt; oldestKey = k; }
    if (oldestKey) registry.delete(oldestKey);
  }
  const controller = new AbortController();
  registry.set(messageId, { controller, startedAt: Date.now() });
  return controller;
}

export function signalFor(messageId: string): AbortSignal | undefined {
  return registry.get(messageId)?.controller.signal;
}

export function cancelRun(messageId: string, reason = "user_stop"): boolean {
  const e = registry.get(messageId);
  if (!e) return false;
  if (e.controller.signal.aborted) return true;
  e.controller.abort(reason);
  return true;
}

export function releaseRun(messageId: string): void {
  registry.delete(messageId);
}

export function isCancelled(messageId: string): boolean {
  const e = registry.get(messageId);
  return !!e && e.controller.signal.aborted;
}

export function activeRunCount(): number {
  return registry.size;
}
