import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

/** Never let an unreachable backend hang the route — blank screen ka root cause. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Preview/dev hosts: skip external auth check — founder works here while building.
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const isPreview =
        host === "localhost" ||
        host.endsWith(".lovableproject.com") ||
        host.endsWith(".lovable.dev") ||
        host.endsWith(".lovable.app") ||
        host.includes("id-preview--") ||
        host.startsWith("preview--");
      if (isPreview) return { user: null };

      const session = await withTimeout(
        fetch("/api/founder/session", { credentials: "same-origin" }),
        6000,
      );
      if (session?.ok) {
        const payload = (await session.json().catch(() => null)) as { user?: unknown } | null;
        return { user: payload?.user ?? null };
      }
      // Session cookie nahi hai → seedha login page. Supabase 3 (self-hosted) par
      // wait nahi karna, warna page hamesha blank rehta hai.
      throw redirect({ to: "/auth" });
    }

    if (!SUPABASE3_READY) throw redirect({ to: "/auth" });
    const result = await withTimeout(supabase3.auth.getUser(), 6000);
    if (!result || result.error || !result.data?.user) throw redirect({ to: "/auth" });
    return { user: result.data.user };
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#E50914]" />
        Founder access verify ho raha hai…
      </div>
    </div>
  ),
  component: () => <Outlet />,
});

