import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Server not ready yet → let founder in so they can see the shell.
    // Once SUPABASE3_URL + ANON_KEY are filled in, real gate kicks in.
    if (!SUPABASE3_READY) return { user: null };

    const { data, error } = await supabase3.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
