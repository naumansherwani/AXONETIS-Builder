import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

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

      const session = await fetch("/api/founder/session", { credentials: "same-origin" }).catch(
        () => null,
      );
      if (session?.ok) {
        const payload = (await session.json().catch(() => null)) as { user?: unknown } | null;
        return { user: payload?.user ?? null };
      }
    }

    if (!SUPABASE3_READY) throw redirect({ to: "/auth" });
    const { data, error } = await supabase3.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
