/**
 * Supabase 3 — Founder AI Builder™
 *
 * This is a SEPARATE Supabase instance (self-hosted on Hetzner) used ONLY by
 * the Builder itself. It is isolated from HostFlow AI (Supabase 1) and
 * ANEXVOT AI PAY (Supabase 2).
 *
 * IMPORTANT: the client is created LAZILY. Creating it at module scope crashes
 * the SSR worker/Node server because realtime-js needs a WebSocket constructor
 * at construction time. A lazy proxy keeps module import side-effect free.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = (import.meta.env.VITE_SUPABASE3_URL as string | undefined) ?? "";
const ANON_KEY = (import.meta.env.VITE_SUPABASE3_ANON_KEY as string | undefined) ?? "";

export const SUPABASE3_READY = Boolean(URL && ANON_KEY);

let instance: SupabaseClient | undefined;

/**
 * On the server (Node/worker) there is no global WebSocket in some runtimes, and
 * realtime-js throws at construction time. Realtime is only ever used in the
 * browser, so we hand the server a harmless stub transport.
 */
const ServerWebSocketStub = class {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly readyState = 3;
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
} as unknown as typeof WebSocket;

export function getSupabase3(): SupabaseClient {
  if (!instance) {
    const isBrowser = typeof window !== "undefined";
    const hasWebSocket = typeof globalThis.WebSocket !== "undefined";
    instance = createClient(
      URL || "https://placeholder.supabase.co",
      ANON_KEY || "placeholder-anon-key",
      {
        auth: {
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: isBrowser,
          storageKey: "fb.supabase3.auth",
        },
        ...(hasWebSocket ? {} : { realtime: { transport: ServerWebSocketStub } }),
      },
    );
  }
  return instance;
}

/** Lazy proxy — behaves like a SupabaseClient but only constructs on first use. */
export const supabase3: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase3() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, prop) {
    return prop in (getSupabase3() as unknown as object);
  },
});
