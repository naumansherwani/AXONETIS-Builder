/**
 * PHASE 11.1 — OUTREACH ENGINE pipeline API.
 * Reads/writes `outreach_leads` on Supabase 3 (self-hosted) + realtime subscription.
 * Frontend only — Jimmy's scraper/sender lives on the Hetzner engine.
 */
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

export const PIPELINE_STAGES = [
  "scraped",
  "qualified",
  "contacted",
  "replied",
  "demo",
  "closed",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  scraped: "Scraped",
  qualified: "Qualified",
  contacted: "Contacted",
  replied: "Replied",
  demo: "Demo",
  closed: "Closed",
};

export interface Lead {
  id: string;
  company: string;
  contact_name: string | null;
  email: string | null;
  website: string | null;
  industry: string | null;
  country: string | null;
  stage: PipelineStage;
  mrr_value: number;
  score: number | null;
  owner_agent: string | null;
  last_touch_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PipelineSnapshot {
  leads: Lead[];
  live: boolean;
  error?: string;
}

const EMPTY: PipelineSnapshot = { leads: [], live: false };

function normalize(row: Record<string, unknown>): Lead {
  const stage = String(row.stage ?? "scraped") as PipelineStage;
  return {
    id: String(row.id),
    company: String(row.company ?? "Unknown"),
    contact_name: (row.contact_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    stage: PIPELINE_STAGES.includes(stage) ? stage : "scraped",
    mrr_value: Number(row.mrr_value ?? 0),
    score: row.score == null ? null : Number(row.score),
    owner_agent: (row.owner_agent as string | null) ?? null,
    last_touch_at: (row.last_touch_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function fetchPipeline(): Promise<PipelineSnapshot> {
  if (!SUPABASE3_READY) return { ...EMPTY, error: "Supabase 3 not configured" };
  const { data, error } = await supabase3
    .from("outreach_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return { ...EMPTY, error: error.message };
  return { leads: (data ?? []).map((r) => normalize(r as Record<string, unknown>)), live: true };
}

export async function moveLead(
  id: string,
  stage: PipelineStage,
): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE3_READY) return { ok: false, error: "Supabase 3 not configured" };
  const { error } = await supabase3
    .from("outreach_leads")
    .update({ stage, last_touch_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Realtime: any change to outreach_leads triggers the callback. Returns unsubscribe. */
export function subscribePipeline(onChange: () => void): () => void {
  if (!SUPABASE3_READY || typeof window === "undefined") return () => {};
  const channel = supabase3
    .channel("outreach_leads_pipeline")
    .on("postgres_changes", { event: "*", schema: "public", table: "outreach_leads" }, onChange)
    .subscribe();
  return () => {
    void supabase3.removeChannel(channel);
  };
}

/** ARR = closed MRR × 12 (real rows only, no estimates). */
export function computeArr(leads: Lead[]): number {
  return leads.filter((l) => l.stage === "closed").reduce((sum, l) => sum + l.mrr_value, 0) * 12;
}

/** Weighted pipeline value — stage probability × MRR × 12. */
const STAGE_PROBABILITY: Record<PipelineStage, number> = {
  scraped: 0.02,
  qualified: 0.1,
  contacted: 0.2,
  replied: 0.35,
  demo: 0.6,
  closed: 1,
};

export function computeWeightedArr(leads: Lead[]): number {
  return leads.reduce((sum, l) => sum + l.mrr_value * 12 * STAGE_PROBABILITY[l.stage], 0);
}

export function groupByStage(leads: Lead[]): Record<PipelineStage, Lead[]> {
  const out = {} as Record<PipelineStage, Lead[]>;
  for (const s of PIPELINE_STAGES) out[s] = [];
  for (const l of leads) out[l.stage].push(l);
  return out;
}

export function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PHASE 11.2 — DAILY STANDUP  ·  PHASE 11.3 — COMPLIANCE BADGE
 * Tables (Supabase 3, self-hosted): outreach_campaigns, outreach_standups,
 * outreach_compliance. Frontend read/write only — Jimmy writes the standup row
 * and Sherlock writes the compliance row from the Hetzner engine.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface StandupIssue {
  severity: "critical" | "warning" | "info";
  title: string;
  detail?: string | null;
}

export interface StandupStats {
  scraped: number;
  qualified: number;
  sent: number;
  replies: number;
  demos: number;
  closed: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: "running" | "paused";
  provider: string | null;
  daily_quota: number;
  sent_today: number;
}

export interface Standup {
  id: string;
  agent_slug: string;
  message: string;
  stats: StandupStats | null;
  issues: StandupIssue[];
  created_at: string;
}

export interface StandupSnapshot {
  standup: Standup | null;
  campaign: Campaign | null;
  stats: StandupStats;
  live: boolean;
  error?: string;
}

const EMPTY_STATS: StandupStats = {
  scraped: 0,
  qualified: 0,
  sent: 0,
  replies: 0,
  demos: 0,
  closed: 0,
};

/** Stats derived from the real pipeline rows (never estimated). */
export function computeStats(leads: Lead[]): StandupStats {
  const by = groupByStage(leads);
  return {
    scraped: by.scraped.length,
    qualified: by.qualified.length,
    sent: by.contacted.length + by.replied.length + by.demo.length + by.closed.length,
    replies: by.replied.length + by.demo.length + by.closed.length,
    demos: by.demo.length + by.closed.length,
    closed: by.closed.length,
  };
}

export async function fetchStandup(): Promise<StandupSnapshot> {
  if (!SUPABASE3_READY)
    return {
      standup: null,
      campaign: null,
      stats: EMPTY_STATS,
      live: false,
      error: "Supabase 3 not configured",
    };

  const [standupRes, campaignRes, pipeline] = await Promise.all([
    supabase3
      .from("outreach_standups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase3
      .from("outreach_campaigns")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchPipeline(),
  ]);

  const error = standupRes.error?.message ?? campaignRes.error?.message ?? pipeline.error;
  const sRow = standupRes.data as Record<string, unknown> | null;
  const cRow = campaignRes.data as Record<string, unknown> | null;

  const standup: Standup | null = sRow
    ? {
        id: String(sRow.id),
        agent_slug: String(sRow.agent_slug ?? "jimmy"),
        message: String(sRow.message ?? ""),
        stats: (sRow.stats as StandupStats | null) ?? null,
        issues: Array.isArray(sRow.issues) ? (sRow.issues as StandupIssue[]) : [],
        created_at: String(sRow.created_at ?? new Date().toISOString()),
      }
    : null;

  const campaign: Campaign | null = cRow
    ? {
        id: String(cRow.id),
        name: String(cRow.name ?? "Outreach"),
        status: cRow.status === "paused" ? "paused" : "running",
        provider: (cRow.provider as string | null) ?? null,
        daily_quota: Number(cRow.daily_quota ?? 0),
        sent_today: Number(cRow.sent_today ?? 0),
      }
    : null;

  return {
    standup,
    campaign,
    stats: standup?.stats ?? computeStats(pipeline.leads),
    live: pipeline.live,
    error,
  };
}

export async function setCampaignStatus(
  id: string,
  status: "running" | "paused",
): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE3_READY) return { ok: false, error: "Supabase 3 not configured" };
  const { error } = await supabase3
    .from("outreach_campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function increaseQuota(
  id: string,
  current: number,
  step = 50,
): Promise<{ ok: boolean; quota?: number; error?: string }> {
  if (!SUPABASE3_READY) return { ok: false, error: "Supabase 3 not configured" };
  const quota = current + step;
  const { error } = await supabase3
    .from("outreach_campaigns")
    .update({ daily_quota: quota, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, quota };
}

/** Realtime for standup + campaign rows. Returns unsubscribe. */
export function subscribeStandup(onChange: () => void): () => void {
  if (!SUPABASE3_READY || typeof window === "undefined") return () => {};
  const channel = supabase3
    .channel("outreach_standup_live")
    .on("postgres_changes", { event: "*", schema: "public", table: "outreach_standups" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "outreach_campaigns" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "outreach_leads" }, onChange)
    .subscribe();
  return () => {
    void supabase3.removeChannel(channel);
  };
}

/* ── PHASE 11.3 — COMPLIANCE ─────────────────────────────────────────────── */

export interface Compliance {
  id: string;
  gdpr_ok: boolean;
  gdpr_note: string | null;
  spam_score: number | null;
  unsubscribe_ok: boolean;
  sherlock_approved: boolean;
  sherlock_note: string | null;
  sherlock_approved_at: string | null;
  checked_at: string | null;
}

export interface ComplianceSnapshot {
  compliance: Compliance | null;
  live: boolean;
  error?: string;
}

export type Tone = "green" | "amber" | "red" | "muted";

/** Spam score bands LOCKED: <3 green · 3-5 amber · >5 red. */
export function spamTone(score: number | null): Tone {
  if (score == null) return "muted";
  if (score < 3) return "green";
  if (score <= 5) return "amber";
  return "red";
}

export function complianceTone(c: Compliance | null): Tone {
  if (!c) return "muted";
  const spam = spamTone(c.spam_score);
  if (spam === "red" || !c.unsubscribe_ok || !c.gdpr_ok) return "red";
  if (spam === "amber" || !c.sherlock_approved) return "amber";
  return "green";
}

export async function fetchCompliance(): Promise<ComplianceSnapshot> {
  if (!SUPABASE3_READY)
    return { compliance: null, live: false, error: "Supabase 3 not configured" };
  const { data, error } = await supabase3
    .from("outreach_compliance")
    .select("*")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { compliance: null, live: false, error: error.message };
  if (!data) return { compliance: null, live: true };
  const row = data as Record<string, unknown>;
  return {
    live: true,
    compliance: {
      id: String(row.id),
      gdpr_ok: Boolean(row.gdpr_ok),
      gdpr_note: (row.gdpr_note as string | null) ?? null,
      spam_score: row.spam_score == null ? null : Number(row.spam_score),
      unsubscribe_ok: Boolean(row.unsubscribe_ok),
      sherlock_approved: Boolean(row.sherlock_approved),
      sherlock_note: (row.sherlock_note as string | null) ?? null,
      sherlock_approved_at: (row.sherlock_approved_at as string | null) ?? null,
      checked_at: (row.checked_at as string | null) ?? null,
    },
  };
}

export function subscribeCompliance(onChange: () => void): () => void {
  if (!SUPABASE3_READY || typeof window === "undefined") return () => {};
  const channel = supabase3
    .channel("outreach_compliance_live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "outreach_compliance" },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase3.removeChannel(channel);
  };
}
