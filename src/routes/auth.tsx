import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Github, KeyRound, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import KernelLogo from "@/components/builder/KernelLogo";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Founder Access — AXONETIS AI Builder™" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [pat, setPat] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !pat.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    const response = await fetch("/api/founder/github-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, pat }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus("error");
      setErrorMsg(payload?.error ?? "Founder access verify nahi hua.");
      return;
    }

    setStatus("sent");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#E50914]/[0.04] blur-[160px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[#1a0933]/25 blur-[140px]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 15 }}
          className="fb-glass fb-hairline w-full max-w-md rounded-2xl p-8 shadow-2xl"
        >
          <div className="mb-8 flex flex-col gap-2">
            <KernelLogo state="standby" size={22} />
            <div className="mt-2 text-lg font-semibold leading-tight">AXONETIS AI Builder™</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Founder OS · Private Workspace
            </div>
          </div>


          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Founder access</h1>
          <p className="mb-8 text-sm text-muted-foreground">
            GitHub username aur personal access token se enter karein.
          </p>

          {status === "sent" ? (
            <div className="rounded-lg border border-[#E50914]/30 bg-[#E50914]/5 p-4 text-sm">
              <div className="font-medium text-foreground">Access verified</div>
              <div className="mt-1 text-muted-foreground">
                Builder workspace open ho raha hai.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="GitHub username"
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#E50914]/50 focus:bg-white/[0.04]"
                />
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="GitHub PAT"
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#E50914]/50 focus:bg-white/[0.04]"
                />
              </div>

              <Button
                type="submit"
                disabled={status === "sending"}
                className="fb-pulse h-11 w-full rounded-lg bg-[#E50914] font-medium text-white hover:bg-[#E50914]/90"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <Github className="h-4 w-4" />
                    Enter builder
                  </>
                )}
              </Button>

              {status === "error" && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-200/90">
                  {errorMsg}
                </div>
              )}
            </form>
          )}

          <div className="mt-8 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>v0.1 · Founder build</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              AXONETIS LIVE
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
