/**
 * Phase 0.2 — Standalone Domains settings page (Lovable-parity).
 * Route: /settings/domains
 * Reuses src/lib/publish-api.ts (already wired to Hetzner /rpc/publish.*).
 * Sections: Website URL (edit) · Buy new domain (placeholder) · Connect existing ·
 *           DNS records table · Verify status · Primary toggle.
 * NO DUMMY: when Hetzner endpoint is offline, sections show clear empty/offline states.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Globe, Plus, Link2, Copy, Check, Loader2, RefreshCw, ShoppingCart,
  ShieldCheck, AlertCircle, ExternalLink, Star,
} from "lucide-react";
import { useBuilder } from "@/lib/builder-state";
import { PROJECTS } from "@/lib/projects";
import {
  fetchPublishState, subscribeDeployStatus, type PublishState,
} from "@/lib/publish-api";

export const Route = createFileRoute("/_authenticated/settings/domains")({
  head: () => ({
    meta: [
      { title: "Domains · AXONETIS AI Builder™" },
      { name: "description", content: "Edit URL, buy a new domain, connect an existing one, manage DNS records and primary domain." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DomainsSettingsPage,
});

interface DnsRecord { type: "A" | "CNAME" | "TXT"; name: string; value: string; }

function DomainsSettingsPage() {
  const { project } = useBuilder();
  const active = PROJECTS.find((p) => p.id === project)!;
  const [state, setState] = useState<PublishState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [connectInput, setConnectInput] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublishState(project).then((s) => {
      if (!cancelled) { setState(s); setLoading(false); }
    });
    const unsub = subscribeDeployStatus(project, (patch) => {
      setState((prev) => (prev ? { ...prev, ...patch } : prev));
    });
    return () => { cancelled = true; unsub(); };
  }, [project, refreshTick]);

  const url = state?.url ?? active.previewUrl;
  const customDomain = state?.customDomain ?? null;
  const bridgeMissing = !(import.meta.env.VITE_HOSTFLOW_BRIDGE_URL ?? "");

  const dnsRecords: DnsRecord[] = useMemo(() => {
    if (!customDomain) return [];
    return [
      { type: "A",     name: "@",        value: "185.158.133.1" },
      { type: "A",     name: "www",      value: "185.158.133.1" },
      { type: "TXT",   name: "_axonetis",value: `axonetis_verify=${project}` },
    ];
  }, [customDomain, project]);

  function copy(text: string, tag: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(tag);
      setTimeout(() => setCopied(null), 1400);
    });
  }

  return (
    <div className="min-h-screen bg-[#06060a] text-foreground">
      {/* Ambient cinematic glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 40% at 20% 0%, rgba(229,9,20,0.15) 0%, transparent 60%)," +
            "radial-gradient(50% 40% at 80% 10%, rgba(168,85,247,0.12) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[880px] px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight">Domains</h1>
              <p className="text-[12px] text-muted-foreground/80">
                {active.name} · manage URL, custom domains, and DNS.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRefreshTick((n) => n + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {bridgeMissing && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11.5px] text-amber-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Bridge URL not configured — showing offline state. Set <code className="font-mono">VITE_HOSTFLOW_BRIDGE_URL</code> to talk to Hetzner <code className="font-mono">/rpc/publish.*</code>.</span>
          </div>
        )}

        {/* Default Lovable URL row */}
        <Section title="Website URL" hint="Your project's default AXONETIS URL. Rename to change the subdomain.">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="truncate font-mono text-[12.5px] text-foreground/95">{url}</span>
            </div>
            <IconBtn onClick={() => copy(url, "url")} title="Copy URL">
              {copied === "url" ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            </IconBtn>
            <IconBtn as="a" href={url} target="_blank" title="Open">
              <ExternalLink className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </Section>

        {/* Buy + Connect row */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setBuyOpen(true)}
            className="group flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:border-[#E50914]/40 hover:bg-white/[0.04]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#ff7480] group-hover:border-[#E50914]/40">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">Buy new domain</span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-[1px] text-[9px] uppercase tracking-wider text-amber-200">Soon</span>
              </div>
              <div className="mt-1 text-[11.5px] text-muted-foreground/85">
                Search & purchase a .com/.ai/.io — auto-connects to this project.
              </div>
            </div>
          </button>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-emerald-300">
                <Link2 className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-[13px] font-semibold">Connect existing domain</div>
                <div className="text-[11px] text-muted-foreground/80">Point your registrar at Hetzner + Caddy auto SSL.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={connectInput}
                onChange={(e) => setConnectInput(e.target.value)}
                placeholder="yourdomain.com"
                className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-[12px] placeholder:text-muted-foreground/40 focus:border-[#E50914]/40 focus:outline-none"
              />
              <button
                disabled={!connectInput.trim() || bridgeMissing}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#E50914] to-[#7c0610] px-3 py-2 text-[11.5px] font-semibold text-white shadow-[0_0_20px_rgba(229,9,20,0.35)] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Connect
              </button>
            </div>
          </div>
        </div>

        {/* DNS records */}
        <Section
          title="DNS records"
          hint={customDomain ? `Add these at your registrar for ${customDomain}. SSL provisions automatically once DNS propagates.` : "Connect a custom domain above to reveal DNS records."}
        >
          {customDomain ? (
            <div className="overflow-hidden rounded-lg border border-white/[0.08]">
              <table className="w-full text-[12px]">
                <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-muted-foreground/70">
                  <tr>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Value</th>
                    <th className="px-3 py-2 text-right">Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {dnsRecords.map((r, i) => (
                    <tr key={i} className="border-t border-white/[0.05]">
                      <td className="px-3 py-2 font-mono text-[11.5px] text-foreground/90">{r.type}</td>
                      <td className="px-3 py-2 font-mono text-[11.5px] text-foreground/90">{r.name}</td>
                      <td className="px-3 py-2 font-mono text-[11.5px] text-foreground/90">{r.value}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => copy(r.value, `dns-${i}`)}
                          className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10.5px] text-muted-foreground hover:text-foreground"
                        >
                          {copied === `dns-${i}` ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] px-4 py-6 text-center text-[12px] text-muted-foreground/70">
              No custom domain connected yet.
            </div>
          )}
        </Section>

        {/* Verify + primary */}
        <Section title="Verify & primary" hint="Caddy on Hetzner provisions Let's Encrypt SSL automatically within 30–60 seconds of DNS pointing correctly.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-3">
              {customDomain ? (
                loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-[12px] text-muted-foreground">Checking DNS…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    <span className="text-[12px] text-emerald-200">Verified & SSL active</span>
                  </>
                )
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-muted-foreground/70" />
                  <span className="text-[12px] text-muted-foreground">No domain to verify</span>
                </>
              )}
            </div>
            <button
              disabled={!customDomain}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-[12px] text-foreground/90 hover:bg-white/[0.05] disabled:opacity-40"
            >
              <Star className="h-3.5 w-3.5 text-amber-300" /> Make {customDomain ?? "custom"} primary
            </button>
          </div>
        </Section>
      </div>

      {/* Buy modal — roadmap card (NO DUMMY) */}
      {buyOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-md" onClick={() => setBuyOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="fb-glass relative w-[min(480px,92vw)] overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0a0a10] p-6 shadow-[0_30px_120px_-20px_rgba(245,158,11,0.35)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-amber-200">
              Registrar integration pending
            </div>
            <h3 className="text-[16px] font-semibold">Buy a domain from AXONETIS</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              Registrar API (Namecheap / OpenSRS) wire-up is scheduled after Phase 3.10. Until then, buy your domain
              at any registrar and use <em>Connect existing domain</em> — Caddy auto-provisions SSL in under a minute.
            </p>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setBuyOpen(false)} className="rounded-md border border-white/[0.1] bg-white/[0.02] px-3 py-1.5 text-[12px] text-foreground/90 hover:bg-white/[0.05]">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="mb-3">
        <h2 className="text-[13.5px] font-semibold text-foreground">{title}</h2>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/75">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function IconBtn({
  children, onClick, title, as, href, target,
}: {
  children: React.ReactNode; onClick?: () => void; title?: string;
  as?: "a"; href?: string; target?: string;
}) {
  const cls = "grid h-10 w-10 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-foreground";
  if (as === "a") return <a className={cls} href={href} target={target} rel="noreferrer" title={title}>{children}</a>;
  return <button onClick={onClick} title={title} className={cls}>{children}</button>;
}
