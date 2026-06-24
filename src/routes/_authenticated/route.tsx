import { useEffect, useState } from "react";
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

/**
 * FOUNDER-ONLY LOCK
 * Workspace is hidden from world until Supabase3 is fully wired.
 * Until then, a passphrase gate keeps the published URL private.
 * Founder unlocks once per browser — passphrase stored in localStorage.
 *
 * Change FOUNDER_PASSPHRASE before publishing publicly.
 */
const FOUNDER_PASSPHRASE =
  (import.meta as any).env?.VITE_FOUNDER_UNLOCK || "axonetis-founder-2026";
const UNLOCK_KEY = "axonetis.founder.unlock.v1";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!SUPABASE3_READY) return { user: null };
    // Preview/dev hosts: skip Supabase user check — founder works here even
    // before magic-link SMTP is wired on the Hetzner instance.
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const isPreview =
        host === "localhost" ||
        host.endsWith(".lovableproject.com") ||
        host.endsWith(".lovable.dev") ||
        host.endsWith(".lovable.app") ||
        host.includes("id-preview--") ||
        host.startsWith("preview--") ||
        host === "aiaxonetis.nexatect.com";
      if (isPreview) return { user: null };
    }
    const { data, error } = await supabase3.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: GatedShell,
});

function GatedShell() {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const host = window.location.hostname;
      // Auto-unlock on dev/preview/sandbox hosts — founder works here.
      // Lock only kicks in on the published public URL.
      const isPreview =
        host === "localhost" ||
        host.endsWith(".lovableproject.com") ||
        host.endsWith(".lovable.dev") ||
        host.includes("id-preview--") ||
        host.startsWith("preview--") ||
        host === "aiaxonetis.nexatect.com";
      if (isPreview) {
        localStorage.setItem(UNLOCK_KEY, "1");
        setUnlocked(true);
        return;
      }
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get("unlock");
      if (fromUrl && fromUrl === FOUNDER_PASSPHRASE) {
        localStorage.setItem(UNLOCK_KEY, "1");
        url.searchParams.delete("unlock");
        window.history.replaceState({}, "", url.toString());
      }
      setUnlocked(localStorage.getItem(UNLOCK_KEY) === "1");
    } catch {
      setUnlocked(false);
    }
  }, []);

  if (unlocked) return <Outlet />;

  return (
    <div className="grid min-h-screen place-items-center bg-[#040406] p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-2xl">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.34em] text-[#94A3B8]">
          Private Workspace
        </div>
        <h1
          className="font-bold uppercase text-[#F8FAFC]"
          style={{
            fontFamily: "'Geist Mono','JetBrains Mono',ui-monospace,monospace",
            fontSize: 28,
            letterSpacing: "0.14em",
            textShadow:
              "0 0 24px rgba(229,9,20,0.32), 0 0 60px rgba(168,85,247,0.16)",
          }}
        >
          AXONETIS
        </h1>
        <p className="mt-4 text-sm text-[#CBD5E1]">
          This workspace is founder-only. Access is restricted.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pass === FOUNDER_PASSPHRASE) {
              localStorage.setItem(UNLOCK_KEY, "1");
              setUnlocked(true);
            } else {
              setErr("Incorrect passphrase.");
            }
          }}
        >
          <input
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setErr("");
            }}
            placeholder="Founder passphrase"
            className="w-full rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E50914]/60"
            autoFocus
          />
          {err && <div className="text-xs text-red-400">{err}</div>}
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-[#E50914] to-[#7c0610] py-2.5 text-sm font-semibold uppercase tracking-wider text-white shadow-[0_8px_30px_-8px_rgba(229,9,20,0.55)]"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
