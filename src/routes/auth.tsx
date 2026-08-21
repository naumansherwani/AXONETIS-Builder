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
      <div className="pointer-events-none absolute inset-y-0 left-[8%] w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-16 px-6 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-14">
        <motion.section
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="hidden max-w-2xl lg:block"
        >
          <div className="mb-12 flex items-center gap-4">
            <AxenMark state="standby" size={52} />
            <div>
              <div className="font-mono text-sm font-semibold uppercase tracking-[0.24em]">AXONETIS</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">AI Builder™</div>
            </div>
          </div>
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-primary">Founder Command Access</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-normal xl:text-6xl">
            Build the systems that build the future.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground">
            NEXATECT™ autonomous technology execution core ka private founder workspace.
          </p>
          <div className="mt-14 flex items-center gap-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Encrypted founder session · Private access only</span>
          </div>
        </motion.section>

        <section className="flex items-center justify-center lg:justify-end">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 15 }}
          className="fb-glass fb-hairline w-full max-w-md rounded-xl p-7 shadow-2xl sm:p-9"
        >
          <div className="mb-9 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <AxenMark state="standby" size={38} />
              <div>
                <div className="font-mono text-xs font-semibold uppercase tracking-[0.2em]">AXONETIS</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">AI Builder™</div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Secure gateway</p>
            <h2 className="text-3xl font-semibold tracking-normal">Welcome back, Founder.</h2>
          </div>
          <p className="mb-7 text-sm leading-6 text-muted-foreground">
            Apne AXONETIS founder credentials se workspace unlock karein.
          </p>

          {status === "sent" ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
              <div className="font-medium text-foreground">Access verified</div>
              <div className="mt-1 text-muted-foreground">Builder workspace open ho raha hai.</div>
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
                  className="h-12 w-full rounded-md border border-input bg-secondary/50 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
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
                  className="h-12 w-full rounded-md border border-input bg-secondary/50 pl-10 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
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
                className="fb-pulse h-12 w-full rounded-md font-semibold"
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
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground">
                  {errorMsg}
                </div>
              )}
            </form>
          )}

          <div className="mt-8 border-t border-border pt-5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Founder-only · NEXATECT™ Global
          </div>
        </motion.div>
        </section>
      </div>
    </main>
  );
}
