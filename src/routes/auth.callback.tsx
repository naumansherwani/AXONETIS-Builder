import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase3 } from "@/integrations/supabase3/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Signing in…" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase detectSessionInUrl handles the token exchange automatically.
    const timer = setTimeout(async () => {
      const { data } = await supabase3.auth.getSession();
      navigate({ to: data.session ? "/" : "/auth", replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-[#E50914]" />
        Verifying magic link…
      </div>
    </div>
  );
}
