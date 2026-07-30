/**
 * Deploy panel — LIVE deployment pipeline pulled from Supabase 3 `deployments`
 * (via versions-api.fetchDeployments, which prefers the Hetzner bridge and
 * falls back to direct Supabase 3 read).
 */
import { useEffect, useState } from "react";
import { PanelSection } from "./PanelChrome";
import { CheckCircle2, Circle, Loader2, Rocket, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useBuilder } from "@/lib/builder-state";
import { fetchDeployments, type Deployment } from "@/lib/versions-api";

type Stage = {
  key: "sandbox" | "staging" | "production";
  label: string;
  deployment: Deployment | null;
};

const rel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

function stageStateFor(dep: Deployment | null): "done" | "active" | "queued" | "failed" {
  if (!dep) return "queued";
  if (dep.status === "failed" || dep.status === "rolled_back") return "failed";
  if (dep.status === "live") return "done";
  return "active";
}

export default function DeployPanel() {
  const { project } = useBuilder();
  const [deps, setDeps] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchDeployments(project)
      .then((rows) => {
        if (alive) setDeps(rows);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [project]);

  const latestSandbox = deps.find((d) => d.target_env === "sandbox") ?? null;
  // Staging is derived: any building deployment targeting production
  const latestStaging =
    deps.find(
      (d) => d.target_env === "production" && (d.status === "pending" || d.status === "building"),
    ) ?? null;
  const latestProd =
    deps.find((d) => d.target_env === "production" && d.status === "live" && d.current) ?? null;

  const stages: Stage[] = [
    { key: "sandbox", label: "Sandbox", deployment: latestSandbox },
    { key: "staging", label: "Staging", deployment: latestStaging },
    { key: "production", label: "Production", deployment: latestProd },
  ];

  const recent = deps.slice(0, 5);
  const canPromote =
    latestSandbox &&
    latestSandbox.status === "live" &&
    (!latestProd || latestProd.id !== latestSandbox.id);

  return (
    <div>
      <PanelSection
        title="Pipeline"
        action={
          loading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" /> : null
        }
      >
        <div className="space-y-1.5 px-1">
          {stages.map((s, i) => {
            const state = stageStateFor(s.deployment);
            return (
              <div key={s.key} className="flex items-center gap-3">
                <StageIcon state={state} />
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-foreground/95">{s.label}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    {s.deployment
                      ? `${s.deployment.status} · ${rel(s.deployment.started_at)}`
                      : "no deployment"}
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <span className="ml-auto text-muted-foreground/30">→</span>
                )}
              </div>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection
        title="Recent Deploys"
        action={<span className="text-[10px] text-muted-foreground/60">{deps.length}</span>}
      >
        {recent.length === 0 ? (
          <div className="rounded-md border border-white/[0.05] bg-white/[0.01] px-3 py-3 text-center text-[11px] text-muted-foreground/70">
            {loading ? "loading…" : "no deployments yet"}
          </div>
        ) : (
          <div className="space-y-1 text-[11px]">
            {recent.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded px-2 py-1 hover:bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <div className="truncate text-foreground/90">
                    {d.label ?? d.summary ?? d.id.slice(0, 8)}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground/60">
                    {d.id.slice(0, 8)} · {d.target_env} · {d.files_changed} files
                  </div>
                </div>
                <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                  {rel(d.started_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      <button
        disabled={!canPromote}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#E50914] to-[#7c0610] py-2 text-[12px] font-semibold uppercase tracking-wider text-white shadow-[0_8px_30px_-8px_rgba(229,9,20,0.55)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        <Rocket className="h-3.5 w-3.5" /> Promote to Production
      </button>
    </div>
  );
}

function StageIcon({ state }: { state: "done" | "active" | "queued" | "failed" }) {
  if (state === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (state === "failed") return <XCircle className="h-4 w-4 text-red-400" />;
  if (state === "active")
    return (
      <motion.span
        className="grid h-4 w-4 place-items-center rounded-full bg-[#E50914] shadow-[0_0_12px_#E50914]"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <span className="h-1 w-1 rounded-full bg-white" />
      </motion.span>
    );
  return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}
