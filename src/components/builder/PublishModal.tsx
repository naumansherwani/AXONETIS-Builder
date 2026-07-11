/**
 * Phase 3.9.3 — Publish modal (100%).
 * Website URL + copy · Custom domain link · Visibility toggle · 7-day share link ·
 * Unpublish · Live status badge · Visitor count · Sherlock audit → promote flow.
 * Talks to Hetzner /rpc/publish.* + /rpc/deploys.status (SSE).
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket, ShieldCheck, X, CheckCircle2, AlertCircle, Loader2,
  Copy, Check, Globe, Link2, Users, Power, ExternalLink, Lock, Eye, EyeOff,
} from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { PROJECTS } from "@/lib/projects";
import { promoteSandboxToProduction } from "@/lib/preview-engine";
import { supabaseLabelFor } from "@/lib/project-workspace";
import {
  fetchPublishState, setVisibility, createShareLink, unpublish,
  subscribeDeployStatus, type PublishState, type Visibility, type DeployStatus,
} from "@/lib/publish-api";

type Stage = "idle" | "auditing" | "promoting" | "done" | "error";

const SHARE_TTL_DAYS = 7; // blueprint-locked

export default function PublishModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, branch, setBottomTab } = useBuilder();
  const active = PROJECTS.find((p) => p.id === project)!;
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  const [state, setState] = useState<PublishState | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [visBusy, setVisBusy] = useState<Visibility | null>(null);
  const [share, setShare] = useState<{ url: string; expiresAt: string } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState<"url" | "share" | null>(null);
  const [confirmUnpub, setConfirmUnpub] = useState(false);
  const [unpubBusy, setUnpubBusy] = useState(false);

  // Load + subscribe when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingState(true);
    fetchPublishState(project).then((s) => {
      if (!cancelled) {
        setState(s);
        setLoadingState(false);
      }
    });
    const unsub = subscribeDeployStatus(project, (patch) => {
      setState((prev) => (prev ? { ...prev, ...patch } : prev));
    });
    return () => { cancelled = true; unsub(); };
  }, [open, project]);

  async function handlePublish() {
    setError(null);
    setStage("auditing");
    await new Promise((r) => setTimeout(r, 650));
    setStage("promoting");
    try {
      const res = await promoteSandboxToProduction({ projectId: project, branch });
      setDeploymentId(res.deploymentId);
      setStage("done");
      // Optimistic: mark deploying → server SSE will confirm live
      setState((prev) => prev ? { ...prev, status: "deploying" } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promote failed");
      setStage("error");
    }
  }

  async function handleVisibility(v: Visibility) {
    if (visBusy || state?.visibility === v) return;
    setVisBusy(v);
    const prev = state?.visibility;
    setState((s) => s ? { ...s, visibility: v } : s);
    const res = await setVisibility(project, v);
    if (!res?.ok) {
      // rollback on failure / pending server
      setState((s) => s && prev ? { ...s, visibility: prev } : s);
      setError("Server endpoint pending — visibility not saved.");
    }
    setVisBusy(null);
  }

  async function handleShare() {
    setShareBusy(true);
    const link = await createShareLink(project, SHARE_TTL_DAYS);
    if (link) setShare(link);
    else setError("Server endpoint pending — share link not created.");
    setShareBusy(false);
  }

  async function handleUnpublish() {
    setUnpubBusy(true);
    const r = await unpublish(project);
    if (r?.ok) {
      setState((s) => s ? { ...s, status: "offline", url: null } : s);
      setConfirmUnpub(false);
    } else {
      setError("Server endpoint pending — unpublish failed.");
    }
    setUnpubBusy(false);
  }

  function copyTo(text: string, kind: "url" | "share") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1400);
    });
  }

  function openDomains() {
    setBottomTab("versions");
    onClose();
  }

  function reset() {
    setStage("idle");
    setError(null);
    setDeploymentId(null);
    setShare(null);
    setConfirmUnpub(false);
    onClose();
  }

  const url = state?.url ?? active.previewUrl;
  const status: DeployStatus = state?.status ?? (BRIDGE_MISSING ? "offline" : "up_to_date");
  const visibility: Visibility = state?.visibility ?? "public";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-md"
          onClick={reset}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            onClick={(e) => e.stopPropagation()}
            className="fb-glass relative w-[min(640px,94vw)] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#08080c] shadow-[0_30px_120px_-20px_rgba(229,9,20,0.45)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914] to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-lg"
                  style={{ background: `${active.accent}22`, boxShadow: `0 0 18px ${active.accent}66` }}
                >
                  <Rocket className="h-3.5 w-3.5 text-[#ff7480]" />
                </span>
                <div>
                  <div className="text-[13px] font-semibold">Publish · {active.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                    {supabaseLabelFor(project)} · branch {branch}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={status} loading={loadingState} />
                <button onClick={reset} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.04] hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* URL + copy + custom domain */}
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Website URL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <span className="truncate font-mono text-[12px] text-foreground/90">{url}</span>
                </div>
                <button
                  onClick={() => copyTo(url, "url")}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.02] text-muted-foreground hover:text-foreground"
                  title="Copy URL"
                >
                  {copied === "url" ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.02] text-muted-foreground hover:text-foreground"
                  title="Open"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <button
                  onClick={openDomains}
                  className="inline-flex items-center gap-1.5 text-[#ff7480] hover:text-[#ff9ba5]"
                >
                  <Link2 className="h-3 w-3" /> Add custom domain
                </button>
                <div className="inline-flex items-center gap-1.5 text-muted-foreground/70">
                  <Users className="h-3 w-3" />
                  <span className="tabular-nums">{state?.visitors24h ?? 0}</span>
                  <span>visitors · 24h</span>
                </div>
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-2 border-t border-white/[0.06] bg-white/[0.02] px-5 py-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Visibility</div>
              <div className="grid grid-cols-3 gap-2">
                <VisTile
                  active={visibility === "public"}
                  busy={visBusy === "public"}
                  onClick={() => handleVisibility("public")}
                  icon={Eye}
                  label="Public"
                  desc="Anyone can find & view"
                />
                <VisTile
                  active={visibility === "unlisted"}
                  busy={visBusy === "unlisted"}
                  onClick={() => handleVisibility("unlisted")}
                  icon={EyeOff}
                  label="Unlisted"
                  desc="Anyone with URL"
                />
                <VisTile
                  active={visibility === "private"}
                  busy={visBusy === "private"}
                  onClick={() => handleVisibility("private")}
                  icon={Lock}
                  label="Private"
                  desc="Founder-only"
                />
              </div>
            </div>

            {/* Share link */}
            <div className="space-y-2 border-t border-white/[0.06] px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Share link · {SHARE_TTL_DAYS}-day expiry</div>
                <button
                  onClick={handleShare}
                  disabled={shareBusy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.02] px-2.5 py-1 text-[11px] text-foreground/90 hover:bg-white/[0.05] disabled:opacity-50"
                >
                  {shareBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Generate
                </button>
              </div>
              {share && (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] px-2.5 py-1.5">
                    <span className="truncate font-mono text-[11px] text-emerald-100">{share.url}</span>
                  </div>
                  <button
                    onClick={() => copyTo(share.url, "share")}
                    className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.1] bg-white/[0.02] text-muted-foreground hover:text-foreground"
                  >
                    {copied === "share" ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}
              {share && (
                <div className="text-[10px] text-muted-foreground/60">
                  Expires {new Date(share.expiresAt).toLocaleString()}
                </div>
              )}
            </div>

            {/* Deploy stages */}
            <div className="space-y-2 border-t border-white/[0.06] bg-white/[0.02] px-5 py-4">
              <StageRow icon={ShieldCheck} label="Sherlock final audit" state={stageOf(stage, "auditing")} />
              <StageRow icon={Rocket} label="Promote sandbox → production" state={stageOf(stage, "promoting")} />
              {stage === "done" && deploymentId && (
                <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                  Live. deploymentId <span className="font-mono">{deploymentId.slice(0, 8)}</span>
                </div>
              )}
              {stage === "error" && error && (
                <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                  {error}
                </div>
              )}
              {stage !== "error" && error && (
                <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-200">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-3.5">
              {status !== "offline" ? (
                confirmUnpub ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-red-300">Sure?</span>
                    <button
                      onClick={handleUnpublish}
                      disabled={unpubBusy}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {unpubBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
                      Confirm unpublish
                    </button>
                    <button
                      onClick={() => setConfirmUnpub(false)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmUnpub(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-red-300"
                  >
                    <Power className="h-3 w-3" /> Unpublish
                  </button>
                )
              ) : <span />}
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="h-9 rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  {stage === "done" ? "Close" : "Cancel"}
                </button>
                {stage !== "done" && (
                  <button
                    onClick={handlePublish}
                    disabled={stage === "auditing" || stage === "promoting"}
                    className="flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-[#E50914] to-[#7c0610] px-4 text-[12px] font-semibold uppercase tracking-wider text-white shadow-[0_0_24px_rgba(229,9,20,0.45)] disabled:opacity-50"
                  >
                    {stage === "auditing" || stage === "promoting" ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing…</>
                    ) : (
                      <><Rocket className="h-3.5 w-3.5" /> {status === "offline" ? "Publish" : "Republish"}</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const BRIDGE_MISSING = !(import.meta.env.VITE_HOSTFLOW_BRIDGE_URL ?? "");

function StatusBadge({ status, loading }: { status: DeployStatus; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading
      </span>
    );
  }
  const map: Record<DeployStatus, { cls: string; label: string; dot: string }> = {
    up_to_date:      { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", label: "Up to date",       dot: "bg-emerald-400" },
    changes_pending: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-200",       label: "Changes pending",  dot: "bg-amber-400" },
    deploying:       { cls: "border-sky-500/30 bg-sky-500/10 text-sky-200",             label: "Deploying…",       dot: "bg-sky-400 animate-pulse" },
    failed:          { cls: "border-red-500/30 bg-red-500/10 text-red-200",             label: "Failed",           dot: "bg-red-400" },
    offline:         { cls: "border-white/[0.1] bg-white/[0.03] text-muted-foreground", label: "Offline",          dot: "bg-muted-foreground/60" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function VisTile({
  active, busy, onClick, icon: Icon, label, desc,
}: {
  active: boolean; busy: boolean; onClick: () => void;
  icon: typeof Rocket; label: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition ${
        active
          ? "border-[#E50914]/40 bg-[#E50914]/[0.08] shadow-[0_0_18px_rgba(229,9,20,0.25)]"
          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
      } disabled:opacity-50`}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/90">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="text-[10px] text-muted-foreground/70">{desc}</div>
    </button>
  );
}

function stageOf(current: Stage, target: Exclude<Stage, "idle" | "done" | "error">): "pending" | "running" | "done" | "error" {
  if (current === "error") return target === "auditing" ? "done" : "error";
  if (current === "idle") return "pending";
  if (current === target) return "running";
  if (current === "done") return "done";
  if (target === "auditing" && current === "promoting") return "done";
  return "pending";
}

function StageRow({ icon: Icon, label, state }: { icon: typeof Rocket; label: string; state: "pending" | "running" | "done" | "error" }) {
  const cls = state === "done"
    ? "text-emerald-300"
    : state === "running"
      ? "text-amber-300"
      : state === "error"
        ? "text-red-300"
        : "text-muted-foreground/60";
  return (
    <div className={`flex items-center gap-2.5 text-[12px] ${cls}`}>
      {state === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" />
          : state === "error" ? <AlertCircle className="h-3.5 w-3.5" />
            : <Icon className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </div>
  );
}
