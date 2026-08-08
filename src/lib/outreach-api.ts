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

export async function moveLead(id: string, stage: PipelineStage): Promise<{ ok: boolean; error?: string }> {
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
