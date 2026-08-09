/**
 * Phase 8 — Founder Command Center.
 *
 * Single unified dashboard the founder lives in: aggregates deploy pipeline
 * state, agent health, cost/telemetry, per-project preview health, and the
 * Sherlock auto-fix loop counter — across ALL projects (HostFlow / ANEXVOT AI PAY
 * / AXONETIS). Read-only aggregation layer; NO duplicate logic — pulls from
 * the same primitives the existing Deploy/Analytics/Activity panels use.
 *
 * Hard rules from founder lock:
 *  - No duplicate panels/components/routes/tables.
 *  - Frontend-only. Server endpoints (Sandbox→Staging→Prod promote,
 *    /api/agents/activity/stream, /api/preview/session) already exist.
 *  - Looks Lovable-grade: cinematic, dense, butter-smooth.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Circle, Rocket, ShieldCheck, Zap } from "lucide-react";
import { PanelSection, Dot } from "./PanelChrome";
import { PROJECTS, type ProjectId } from "@/lib/projects";
import { supabaseLabelFor } from "@/lib/project-workspace";
import { listActivity, type AgentActivity } from "@/lib/hostflow-api";
import { getPreviewSession, type PreviewSession } from "@/lib/preview-engine";
import TelemetryStrip from "../TelemetryStrip";

type Stage = "sandbox" | "staging" | "production";
const STAGES: Stage[] = ["sandbox", "staging", "production"];

interface ProjectHealth {
  projectId: ProjectId;
  sandbox?: PreviewSession | null;
  production?: PreviewSession | null;
  recentActivity: AgentActivity[];
  jimmyCount: number;
  sherlockCount: number;
  errorCount: number;
  spend: number;
  tokens: number;
}

export default function CommandCenterPanel() {
  const [healthByProject, setHealth] = useState<Record<ProjectId, ProjectHealth>>(
    () =>
      Object.fromEntries(PROJECTS.map((p) => [p.id, emptyHealth(p.id)])) as Record<
        ProjectId,
        ProjectHealth
      >,
  );
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const results = await Promise.allSettled(
        PROJECTS.map(async (p) => {
          const [sandbox, production, activity] = await Promise.all([
            getPreviewSession(p.id, "sandbox").catch(() => null),
            getPreviewSession(p.id, "production").catch(() => null),
            listActivity({ projectId: p.id, limit: 40 }).catch(() => [] as AgentActivity[]),
          ]);
          return { p, sandbox, production, activity };
        }),
      );
      if (!alive) return;
      const next: Record<ProjectId, ProjectHealth> = { ...healthByProject };
      let anyOnline = false;
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { p, sandbox, production, activity } = r.value;
        if (sandbox || production || activity.length) anyOnline = true;
        next[p.id] = {
          projectId: p.id,
          sandbox,
          production,
          recentActivity: activity,
          jimmyCount: activity.filter((a) => a.agent_slug === "jimmy").length,
          sherlockCount: activity.filter((a) => a.agent_slug === "sherlock").length,
          errorCount: activity.filter((a) => a.kind === "error").length,
          spend: activity.reduce((s, a) => s + (a.cost_usd ?? 0), 0),
          tokens: activity.reduce((s, a) => s + (a.tokens_in ?? 0) + (a.tokens_out ?? 0), 0),
        };
      }
      setHealth(next);
      setOnline(anyOnline);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const list = Object.values(healthByProject);
    return {
      spend: list.reduce((s, h) => s + h.spend, 0),
      tokens: list.reduce((s, h) => s + h.tokens, 0),
      jimmy: list.reduce((s, h) => s + h.jimmyCount, 0),
      sherlock: list.reduce((s, h) => s + h.sherlockCount, 0),
      errors: list.reduce((s, h) => s + h.errorCount, 0),
    };
  }, [healthByProject]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60">
        <span className="flex items-center gap-1.5">
          <Dot tone={online ? "emerald" : "gray"} />
          {online ? "ecosystem live" : "offline"}
        </span>
        <span>{PROJECTS.length} projects · ∞ memory</span>
      </div>

      <TelemetryStrip />

      <PanelSection title="Ecosystem Telemetry">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="24h spend" value={`$${totals.spend.toFixed(4)}`} tone="emerald" />
          <Metric label="Tokens" value={fmt(totals.tokens)} tone="sky" />
          <Metric
            label="Errors"
            value={String(totals.errors)}
            tone={totals.errors > 0 ? "red" : "emerald"}
          />
          <Metric label="Jimmy ops" value={String(totals.jimmy)} tone="violet" />
          <Metric label="Sherlock" value={String(totals.sherlock)} tone="amber" />
          <Metric label="Loop cap" value="3×" tone="gray" />
        </div>
      </PanelSection>

      <PanelSection title="Projects · Pipeline · Health">
        <div className="space-y-2">
          {PROJECTS.map((p) => {
            const h = healthByProject[p.id];
            return (
              <div
                key={p.id}
                className="rounded-lg border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent p-2.5"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]"
                      style={{ color: p.accent, background: p.accent }}
                    />
                    <span className="text-[12px] font-semibold text-foreground/95">
                      {p.shortName}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                      {supabaseLabelFor(p.id)}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground/60">
                    ${h.spend.toFixed(4)} · {fmt(h.tokens)}t
                  </span>
                </div>

                {/* Pipeline strip */}
                <div className="mb-2 flex items-center gap-1.5">
                  {STAGES.map((stage, i) => {
                    const session =
                      stage === "sandbox"
                        ? h.sandbox
                        : stage === "production"
                          ? h.production
                          : null;
                    const state: "done" | "active" | "queued" =
                      session?.status === "ready" ? "done" : session ? "active" : "queued";
                    return (
                      <div key={stage} className="flex flex-1 items-center gap-1.5">
                        {state === "done" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : state === "active" ? (
                          <motion.span
                            className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#E50914] shadow-[0_0_10px_#E50914]"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                          >
                            <span className="h-1 w-1 rounded-full bg-white" />
                          </motion.span>
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                        )}
                        <span className="text-[10px] uppercase tracking-wider text-foreground/85">
                          {stage}
                        </span>
                        {i < STAGES.length - 1 && (
                          <span className="text-muted-foreground/30">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground/75">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-3 w-3 text-violet-300" />J {h.jimmyCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-amber-300" />S {h.sherlockCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Activity className="h-3 w-3 text-sky-300" />
                      {h.recentActivity.length}
                    </span>
                  </span>
                  <span className={h.errorCount > 0 ? "text-red-300" : "text-emerald-300/80"}>
                    {h.errorCount > 0 ? `${h.errorCount} err` : "healthy"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </PanelSection>

      <button
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#E50914] to-[#7c0610] py-2 text-[12px] font-semibold uppercase tracking-wider text-white shadow-[0_8px_30px_-8px_rgba(229,9,20,0.55)]"
        onClick={() => window.dispatchEvent(new CustomEvent("axonetis:publish"))}
      >
        <Rocket className="h-3.5 w-3.5" /> Open Publish Dialog
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "red" | "violet" | "amber" | "gray";
}) {
  const toneCls = {
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    red: "text-red-300",
    violet: "text-violet-300",
    amber: "text-amber-300",
    gray: "text-foreground/90",
  }[tone];
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.015] p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function emptyHealth(projectId: ProjectId): ProjectHealth {
  return {
    projectId,
    recentActivity: [],
    jimmyCount: 0,
    sherlockCount: 0,
    errorCount: 0,
    spend: 0,
    tokens: 0,
  };
}
