/**
 * Versions panel — Phase 6 wired.
 * Sources: snapshots (file_versions) + deployments + rollback_history.
 * Falls back to seed data when bridge / supabase3 not configured.
 */
import { useEffect, useState } from "react";
import { PanelSection, Row } from "./PanelChrome";
import { RotateCcw, Rocket, Globe, Plus, ShieldCheck, ShieldAlert, Loader2, GitCommitHorizontal, Play, Trash2 } from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import {
  fetchDeployments, fetchRollbackHistory, fetchSnapshots, rollback,
  type Deployment, type RollbackEntry, type Snapshot,
} from "@/lib/versions-api";
import {
  attachCaddyDomain, listCaddyDomains, revokeCaddyDomain, checkoutIntoPreview,
  type CaddyDomain,
} from "@/lib/power-tools-api";

const SEED_SNAP: Snapshot[] = [
  { id: "v17", path: "db/migrations/2026_06_14_phase6_versions.sql", change: "create", author: "jimmy",    message: "phase 6 sql",        created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),  env: "sandbox", branch: "main" },
  { id: "v16", path: "src/components/builder/UnifiedChat.tsx",       change: "update", author: "jimmy",    message: "virtual scroll",     created_at: new Date(Date.now() - 9 * 3600_000).toISOString(),  env: "sandbox", branch: "main" },
  { id: "v15", path: "src/components/builder/TopBar.tsx",            change: "update", author: "sherlock", message: "cinematic redesign", created_at: new Date(Date.now() - 11 * 3600_000).toISOString(), env: "sandbox", branch: "main" },
];

const SEED_DEPS: Deployment[] = [
  { id: "d3", project_id: "founderbuilder", label: "phase 6 lock",       summary: "+3 files",  status: "live",        files_changed: 3, started_at: new Date(Date.now() - 1800_000).toISOString(),    finished_at: new Date().toISOString(),                     current: true,  target_env: "production" },
  { id: "d2", project_id: "founderbuilder", label: "phase 5 preview",    summary: "+12 files", status: "rolled_back", files_changed: 12, started_at: new Date(Date.now() - 86400_000).toISOString(),  finished_at: new Date(Date.now() - 86000_000).toISOString(), current: false, target_env: "production" },
  { id: "d1", project_id: "founderbuilder", label: "phase 4 dual-brain", summary: "+8 files",  status: "live",        files_changed: 8, started_at: new Date(Date.now() - 2 * 86400_000).toISOString(), finished_at: new Date(Date.now() - 2 * 86000_000).toISOString(), current: false, target_env: "production" },
];

const rel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function VersionsPanel() {
  const { project } = useBuilder();
  const [snaps, setSnaps] = useState<Snapshot[]>(SEED_SNAP);
  const [deps, setDeps] = useState<Deployment[]>(SEED_DEPS);
  const [history, setHistory] = useState<RollbackEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [domains, setDomains] = useState<CaddyDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [domainErr, setDomainErr] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [checkoutNote, setCheckoutNote] = useState<string | null>(null);

  const refresh = async () => {
    const [s, d, h, dom] = await Promise.all([
      fetchSnapshots(project, 50),
      fetchDeployments(project),
      fetchRollbackHistory(project),
      listCaddyDomains(project),
    ]);
    if (s.length) setSnaps(s);
    if (d.length) setDeps(d);
    if (h.length) setHistory(h);
    if (dom) setDomains(dom);
  };

  useEffect(() => { void refresh(); }, [project]);

  const onRollback = async (scope: "file" | "deployment", id: string) => {
    setBusy(id);
    await rollback({ projectId: project, scope, targetId: id, triggeredBy: "founder" });
    await refresh();
    setBusy(null);
  };

  const onAttachDomain = async () => {
    const d = newDomain.trim().toLowerCase();
    if (!d || attaching) return;
    setAttaching(true);
    setDomainErr(null);
    const res = await attachCaddyDomain(project, d);
    if (res?.ok) {
      setNewDomain("");
      await refresh();
    } else {
      setDomainErr(res?.error ?? "Server endpoint pending — Caddy not reached.");
    }
    setAttaching(false);
  };

  const onRevokeDomain = async (id: string) => {
    setBusy(id);
    await revokeCaddyDomain(id);
    await refresh();
    setBusy(null);
  };

  const onCheckout = async (sha: string) => {
    setCheckoutBusy(sha);
    setCheckoutNote(null);
    const r = await checkoutIntoPreview(project, sha);
    if (r?.ok) setCheckoutNote(`Preview updated → ${r.previewUrl ?? sha.slice(0, 8)}`);
    else setCheckoutNote(r?.error ?? "Server endpoint pending — time-travel offline.");
    setCheckoutBusy(null);
  };

  return (
    <>
      <PanelSection title="Deployments">
        <div className="flex flex-col gap-1">
          {deps.map((d) => (
            <Row
              key={d.id}
              active={d.current}
              left={
                <>
                  <Rocket className={`h-3 w-3 ${d.current ? "text-emerald-400" : "text-muted-foreground/60"}`} />
                  <span className="truncate">{d.label ?? d.id.slice(0, 8)}</span>
                  <span className="rounded bg-white/[0.04] px-1 py-px text-[9px] uppercase tracking-wider text-muted-foreground/70">
                    {d.status}
                  </span>
                </>
              }
              right={
                <span className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/70">{rel(d.started_at)}</span>
                  {!d.current && (
                    <button
                      onClick={() => onRollback("deployment", d.id)}
                      disabled={busy === d.id}
                      title="Restore this deployment"
                      className="grid h-5 w-5 place-items-center rounded hover:bg-white/[0.06] disabled:opacity-40"
                    >
                      <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-[#ff7480]" />
                    </button>
                  )}
                </span>
              }
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Snapshots — time travel">
        <div className="flex flex-col gap-1">
          {snaps.map((s, i) => (
            <Row
              key={s.id}
              active={i === 0}
              left={
                <>
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    s.change === "create" ? "bg-emerald-500/15 text-emerald-300"
                      : s.change === "delete" ? "bg-red-500/15 text-red-300"
                      : "bg-white/[0.06] text-foreground/80"
                  }`}>{s.change[0].toUpperCase()}</span>
                  <span className="truncate">{s.path}</span>
                </>
              }
              right={
                <span className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/70">{rel(s.created_at)}</span>
                  {i !== 0 && (
                    <button
                      onClick={() => onRollback("file", s.id)}
                      disabled={busy === s.id}
                      title="Restore this file"
                      className="grid h-5 w-5 place-items-center rounded hover:bg-white/[0.06] disabled:opacity-40"
                    >
                      <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-[#ff7480]" />
                    </button>
                  )}
                </span>
              }
            />
          ))}
        </div>
      </PanelSection>

      {history.length > 0 && (
        <PanelSection title="Rollback audit">
          <div className="flex flex-col gap-1">
            {history.slice(0, 10).map((h) => (
              <Row
                key={h.id}
                left={
                  <>
                    <span className={`h-1.5 w-1.5 rounded-full ${h.succeeded ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="truncate text-muted-foreground">
                      {h.scope} · {h.triggered_by ?? "system"} {h.reason ? `· ${h.reason}` : ""}
                    </span>
                  </>
                }
                right={<span className="text-[10px] text-muted-foreground/70">{rel(h.created_at)}</span>}
              />
            ))}
          </div>
        </PanelSection>
      )}
    </>
  );
}
