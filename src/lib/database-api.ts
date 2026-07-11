/**
 * Database API — reads Supabase 3 table row counts via head-count queries.
 * Client-side using anon key; each table needs a SELECT policy for `authenticated`
 * or the count returns 0. RLS still enforced.
 */
import { supabase3, SUPABASE3_READY } from "@/integrations/supabase3/client";

export interface TableCount {
  name: string;
  rows: number | null; // null = unreadable (RLS-blocked / missing)
}

const CORE_TABLES = [
  "projects",
  "project_files",
  "ai_agent_identities",
  "ai_model_registry",
  "user_roles",
  "ai_threads",
  "ai_messages",
  "deployments",
] as const;

const MIRROR_TABLES = [
  "mirror_hostflow_tenants",
  "mirror_hostflow_jobs",
  "mirror_rapidpay_accounts",
  "mirror_rapidpay_ledger",
  "mirror_rapidpay_keys",
  "mirror_resolution_cases",
  "mirror_aanris_events",
] as const;

async function countOne(table: string): Promise<number | null> {
  const { count, error } = await supabase3
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

export async function fetchTableCounts(): Promise<{ core: TableCount[]; mirror: TableCount[]; live: boolean }> {
  if (!SUPABASE3_READY) {
    return {
      core: CORE_TABLES.map((name) => ({ name, rows: null })),
      mirror: MIRROR_TABLES.map((name) => ({ name, rows: null })),
      live: false,
    };
  }
  const [core, mirror] = await Promise.all([
    Promise.all(CORE_TABLES.map(async (name) => ({ name, rows: await countOne(name) }))),
    Promise.all(MIRROR_TABLES.map(async (name) => ({ name, rows: await countOne(name) }))),
  ]);
  return { core, mirror, live: true };
}
