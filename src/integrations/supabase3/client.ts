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

export function getSupabase3(): SupabaseClient {
  if (!instance) {
    instance = createClient(URL || "https://placeholder.supabase.co", ANON_KEY || "placeholder-anon-key", {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
        detectSessionInUrl: typeof window !== "undefined",
        storageKey: "fb.supabase3.auth",
      },
    });
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
