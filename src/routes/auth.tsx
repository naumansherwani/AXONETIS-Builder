import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import AxenMark from "@/components/builder/logo-lab/AxonMark";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Founder Access — AXONETIS AI Builder™" },
      { name: "description", content: "Private founder access to AXONETIS AI Builder." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Founder Access — AXONETIS AI Builder™" },
      { property: "og:description", content: "Private founder access to AXONETIS AI Builder." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    const response = await fetch("/api/founder/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
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
    <main className="auth-shell relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-y-0 left-[8%] w-px bg-gradient-to-b from-transparent via-primary/60 to-transparent" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-16 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-14">
        <motion.section
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="hidden max-w-2xl lg:block"
        >
          <div className="mb-12 flex items-center gap-4">
            <AxenMark state="standby" size={56} />
            <div>
              <div className="font-mono text-base font-semibold uppercase tracking-[0.26em] text-foreground">
                AXONETIS
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                AI Builder™ · Founder OS
              </div>
            </div>
          </div>
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.24em] text-primary">
            Founder Command Access
          </p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.06] tracking-tight text-foreground xl:text-6xl">
            Command the engine that builds your companies.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-foreground/80">
            The private control room of NEXATECT™ Global — autonomous agents, live
            infrastructure and production deployments under one command.
          </p>
          <ul className="mt-10 space-y-3 text-sm text-foreground/75">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Sovereign runtime — no third-party cloud in the execution path.
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Autonomous engineering agents with full audit trail.
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              One console for AXONETIS™, ANEXOMAIL™ and ANEXVOT™ Pay.
            </li>
          </ul>
          <div className="mt-14 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Encrypted founder session · Access by invitation only</span>
          </div>
        </motion.section>

        <section className="flex items-center justify-center lg:justify-end">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 15 }}
          className="fb-hairline w-full max-w-md rounded-2xl border border-white/12 bg-[#0B1120]/92 p-7 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-9"
        >
          <div className="mb-9 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <AxenMark state="standby" size={38} />
              <div>
                <div className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
                  AXONETIS
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  AI Builder™
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
              Secure Gateway
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Welcome back, Founder.
            </h2>
          </div>
          <p className="mb-7 text-sm leading-6 text-foreground/70">
            Authenticate with your AXONETIS founder credentials to unlock the workspace.
          </p>

          {status === "sent" ? (
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
              <div className="font-medium text-foreground">Access verified</div>
              <div className="mt-1 text-foreground/70">Opening your builder workspace…</div>
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
                  autoComplete="username"
                  placeholder="Founder username"
                  className="h-12 w-full rounded-lg border border-white/12 bg-white/[0.04] pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Founder password"
                  className="h-12 w-full rounded-lg border border-white/12 bg-white/[0.04] pl-10 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>

              <Button
                type="submit"
                disabled={status === "sending"}
                className="fb-pulse h-12 w-full rounded-lg text-[13px] font-semibold uppercase tracking-[0.14em]"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    Enter AXONETIS
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              {status === "error" && (
                <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground">
                  {errorMsg}
                </div>
              )}
            </form>
          )}

          <div className="mt-8 border-t border-white/10 pt-5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Founder-only access · NEXATECT™ Global
          </div>
        </motion.div>
        </section>
      </div>
    </main>
  );
}
