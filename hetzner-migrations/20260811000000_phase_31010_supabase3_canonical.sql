-- AXONETIS Phase 3.10.10 — SUPABASE 3 CANONICAL MIGRATION
-- tool_call_registry (+ tool_calls view) · agent_subagents · mem_entries (pgvector)
-- Idempotent. Run in the Supabase 3 SQL editor. Safe to re-run.

create extension if not exists vector;
create extension if not exists pg_trgm;

/* ───────────────────────── 1. tool_call_registry ─────────────────────────
   Canonical tool ledger — agents.tools.ts (Phase 3.10.9) writes every call
   here: running → ok | error | aborted. Drives ToolCallBubble + ActivityFeed
   over Realtime, and the Cost Meter (3.9.7) over tokens/cost.
   Blueprint alias `tool_calls` is exposed as a view (NO duplicate table).    */

create table if not exists public.tool_call_registry (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid,
  message_id uuid,
  project_id uuid,
  agent_slug text not null default 'jimmy',
  tool_name text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'running'
    check (status in ('running','ok','error','aborted')),
  error text,
  tokens_in integer,
  tokens_out integer,
  cost numeric(12,6) not null default 0,
  model text,
  duration_ms integer,
  approved_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- additive columns for older installs (never drop) — full column set,
-- because an earlier install may have created this table with fewer columns.
alter table public.tool_call_registry add column if not exists thread_id uuid;
alter table public.tool_call_registry add column if not exists message_id uuid;
alter table public.tool_call_registry add column if not exists project_id uuid;
alter table public.tool_call_registry add column if not exists agent_slug text not null default 'jimmy';
alter table public.tool_call_registry add column if not exists tool_name text;
alter table public.tool_call_registry add column if not exists input jsonb not null default '{}'::jsonb;
alter table public.tool_call_registry add column if not exists output jsonb;
alter table public.tool_call_registry add column if not exists status text not null default 'running';
alter table public.tool_call_registry add column if not exists tokens_in integer;
alter table public.tool_call_registry add column if not exists tokens_out integer;
alter table public.tool_call_registry add column if not exists cost numeric(12,6) not null default 0;
alter table public.tool_call_registry add column if not exists model text;
alter table public.tool_call_registry add column if not exists error text;
alter table public.tool_call_registry add column if not exists duration_ms integer;
alter table public.tool_call_registry add column if not exists approved_by uuid;
alter table public.tool_call_registry add column if not exists created_at timestamptz not null default now();
alter table public.tool_call_registry add column if not exists started_at timestamptz not null default now();
alter table public.tool_call_registry add column if not exists finished_at timestamptz;
update public.tool_call_registry set started_at = created_at where started_at is null;


create index if not exists tool_call_registry_thread_idx
  on public.tool_call_registry (thread_id, started_at desc);
create index if not exists tool_call_registry_project_idx
  on public.tool_call_registry (project_id, started_at desc);
create index if not exists tool_call_registry_live_idx
  on public.tool_call_registry (status) where status = 'running';
create index if not exists tool_call_registry_tool_idx
  on public.tool_call_registry (tool_name, started_at desc);

grant select on public.tool_call_registry to anon, authenticated;
grant all on public.tool_call_registry to service_role;

alter table public.tool_call_registry enable row level security;
drop policy if exists "tool_call_registry readable" on public.tool_call_registry;
create policy "tool_call_registry readable" on public.tool_call_registry
  for select using (true);

-- Blueprint-named alias (id, agent_id, tool_name, input, output, cost, status, created_at)
drop view if exists public.tool_calls;
create view public.tool_calls as
  select id,
         agent_slug   as agent_id,
         tool_name,
         input,
         output,
         cost,
         status,
         started_at   as created_at,
         thread_id,
         project_id,
         duration_ms
  from public.tool_call_registry;
grant select on public.tool_calls to anon, authenticated, service_role;

-- Cost Meter rollup (3.9.7): per project/day tool spend
drop view if exists public.tool_cost_daily;
create view public.tool_cost_daily as
  select project_id,
         date_trunc('day', started_at)::date as day,
         count(*)                            as calls,
         sum(coalesce(tokens_in,0))          as tokens_in,
         sum(coalesce(tokens_out,0))         as tokens_out,
         round(sum(cost)::numeric, 6)        as cost
  from public.tool_call_registry
  group by 1, 2;
grant select on public.tool_cost_daily to anon, authenticated, service_role;

/* ───────────────────────── 2. agent_subagents ─────────────────────────
   Raw spawn_subagent ledger (max 5 live per thread — enforced in tool +
   trigger below). agent_delegations/_tasks stays the UI tree; this is the
   execution record with model + result + cost.                           */

create table if not exists public.agent_subagents (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid,                       -- parent tool_call_registry / subagent id
  thread_id uuid,
  message_id uuid,
  project_id text,
  delegation_id uuid,
  parent_agent text not null default 'jimmy',
  agent text not null default 'advisor',
  task text not null,
  context text,
  status text not null default 'queued'
    check (status in ('queued','running','done','failed','cancelled')),
  model text,
  result text,
  tokens integer,
  cost numeric(12,6) not null default 0,
  duration_ms integer,
  depth integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_subagents add column if not exists delegation_id uuid;
alter table public.agent_subagents add column if not exists cost numeric(12,6) not null default 0;
alter table public.agent_subagents add column if not exists depth integer not null default 1;

create index if not exists agent_subagents_thread_idx
  on public.agent_subagents (thread_id, created_at desc);
create index if not exists agent_subagents_parent_idx
  on public.agent_subagents (parent_id);
create index if not exists agent_subagents_live_idx
  on public.agent_subagents (thread_id) where status in ('queued','running');

grant select on public.agent_subagents to anon, authenticated;
grant all on public.agent_subagents to service_role;

alter table public.agent_subagents enable row level security;
drop policy if exists "agent_subagents readable" on public.agent_subagents;
create policy "agent_subagents readable" on public.agent_subagents
  for select using (true);

-- Hard cap: 5 live sub-agents per thread + max depth 3 (runaway swarm guard)
create or replace function public.enforce_subagent_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_count integer;
begin
  if new.depth > 3 then
    raise exception 'sub-agent depth cap exceeded (max 3)';
  end if;
  if new.status in ('queued','running') then
    select count(*) into live_count
    from public.agent_subagents
    where thread_id = new.thread_id
      and status in ('queued','running')
      and id <> new.id;
    if live_count >= 5 then
      raise exception 'sub-agent cap reached (5 live per thread)';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_agent_subagents_limits on public.agent_subagents;
create trigger trg_agent_subagents_limits
  before insert or update on public.agent_subagents
  for each row execute function public.enforce_subagent_limits();

/* ───────────────────────── 3. mem_entries (pgvector) ─────────────────────────
   Long-term semantic memory for Jimmy/Sherlock/advisors. 1536 dims =
   openai/text-embedding-3-small (cheap, high volume). Keep model_version so a
   future model swap is a re-embed, not a schema break.                        */

create table if not exists public.mem_entries (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null default 'jimmy',
  project_id text,
  thread_id uuid,
  scope text not null default 'semantic'
    check (scope in ('episodic','semantic','procedural','fact','decision')),
  title text,
  content text not null,
  embedding vector(1536),
  model_version text not null default 'openai/text-embedding-3-small',
  importance numeric(4,3) not null default 0.5,
  tokens integer,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  content_hash text generated always as (md5(content)) stored,
  pinned boolean not null default false,
  expires_at timestamptz,
  accessed_at timestamptz not null default now(),
  access_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.mem_entries add column if not exists pinned boolean not null default false;
alter table public.mem_entries add column if not exists expires_at timestamptz;
alter table public.mem_entries add column if not exists access_count integer not null default 0;

-- dedupe: same agent+project must not store identical content twice
create unique index if not exists mem_entries_dedupe_idx
  on public.mem_entries (agent_id, coalesce(project_id,''), content_hash);
create index if not exists mem_entries_agent_idx
  on public.mem_entries (agent_id, scope, importance desc);
create index if not exists mem_entries_project_idx
  on public.mem_entries (project_id, created_at desc);
create index if not exists mem_entries_trgm_idx
  on public.mem_entries using gin (content gin_trgm_ops);
-- 1536 dims ≤ 2000 → index the column directly (no halfvec cast)
create index if not exists mem_entries_embedding_idx
  on public.mem_entries using hnsw (embedding vector_cosine_ops);

grant select on public.mem_entries to authenticated;
grant all on public.mem_entries to service_role;

alter table public.mem_entries enable row level security;
drop policy if exists "mem_entries admin read" on public.mem_entries;
create policy "mem_entries admin read" on public.mem_entries
  for select to authenticated using (true);

-- Vector search (semantic). Called with the query embedding from the bridge.
create or replace function public.match_mem_entries(
  query_embedding vector(1536),
  p_agent_id text default null,
  p_project_id text default null,
  match_count integer default 8,
  min_similarity double precision default 0.55
)
returns table (
  id uuid,
  agent_id text,
  project_id text,
  scope text,
  title text,
  content text,
  importance numeric,
  similarity double precision,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.agent_id, m.project_id, m.scope, m.title, m.content, m.importance,
         1 - (m.embedding <=> query_embedding) as similarity,
         m.created_at
  from public.mem_entries m
  where m.embedding is not null
    and (p_agent_id is null or m.agent_id = p_agent_id)
    and (p_project_id is null or m.project_id = p_project_id)
    and (m.expires_at is null or m.expires_at > now())
    and 1 - (m.embedding <=> query_embedding) >= min_similarity
  order by m.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;
grant execute on function public.match_mem_entries(vector, text, text, integer, double precision)
  to authenticated, service_role;

-- Hybrid fallback when a query has no embedding yet (trigram keyword search)
create or replace function public.search_mem_entries(
  q text,
  p_agent_id text default null,
  match_count integer default 8
)
returns setof public.mem_entries
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.mem_entries
  where (p_agent_id is null or agent_id = p_agent_id)
    and (expires_at is null or expires_at > now())
    and content ilike '%' || q || '%'
  order by importance desc, created_at desc
  limit greatest(1, least(match_count, 50));
$$;
grant execute on function public.search_mem_entries(text, text, integer) to authenticated, service_role;

-- Decay/GC: unpinned, unused, low-importance memories expire (call from cron)
create or replace function public.prune_mem_entries(older_than_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.mem_entries
  where pinned = false
    and importance < 0.35
    and access_count = 0
    and created_at < now() - (older_than_days || ' days')::interval;
  get diagnostics removed = row_count;
  delete from public.mem_entries where expires_at is not null and expires_at < now();
  return removed;
end $$;
grant execute on function public.prune_mem_entries(integer) to service_role;

/* ───────────────────────── 4. Realtime ───────────────────────── */
do $$
declare t text;
begin
  foreach t in array array['tool_call_registry','agent_subagents','mem_entries'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Self-hosted PostgREST schema cache reload; harmless when no listener exists.
notify pgrst, 'reload schema';
