/**
 * Supabase 3 — Founder AI Builder™
 *
 * This is a SEPARATE Supabase instance (self-hosted on Hetzner) used ONLY by
 * the Builder itself. It is isolated from HostFlow AI (Supabase 1) and
 * ANEXVOT AI PAY (Supabase 2).
 *
 * Fill these constants when the Hetzner server is ready. Until then magic-link
 * submission will surface a clear error in the UI — by design.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL =
  (import.meta.env.VITE_SUPABASE3_URL as string | undefined) ?? "";
const ANON_KEY =
  (import.meta.env.VITE_SUPABASE3_ANON_KEY as string | undefined) ?? "";

export const SUPABASE3_READY = Boolean(URL && ANON_KEY);

export const supabase3: SupabaseClient = createClient(
  URL || "https://placeholder.supabase.co",
  ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "fb.supabase3.auth",
    },
  },
);
