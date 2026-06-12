-- =====================================================================
-- AXONETIS AI Builder™ — Phase 3: AI Orchestration Layer
-- Target: self-hosted Supabase on Hetzner (hostflowai-server repo)
-- DO NOT run on Lovable Cloud. Founder runs this on Hetzner Postgres.
-- =====================================================================

-- ---------- ENUMS ----------------------------------------------------
do $$ begin
  create type public.agent_kind as enum ('supreme', 'advisor', 'rapidpay', 'router');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agent_status as enum ('online', 'thinking', 'idle', 'offline', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agent_activity_kind as enum (
    'chat', 'build', 'scan', 'fix', 'deploy', 'rollback', 'memory_write', 'route', 'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.thread_role as enum ('user', 'agent', 'system', 'tool');
exception when duplicate_object then null; end $$;

-- ---------- 1) agent_registry ---------------------------------------
-- Catalog of every agent (Jimmy, Sherlock, 8 advisors, Rapid Pay agents, Router).
create table if not exists public.agent_registry (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,             -- 'jimmy', 'sherlock', 'aria', ...
  name          text not null,
  role          text not null,                    -- 'Build · Design · Architect'
  kind          public.agent_kind not null,
  model_primary text not null,                    -- 'hermes-405b'
  model_fallback text[],                          -- ['qwen3-coder-480b']
  status        public.agent_status not null default 'idle',
  config        jsonb not null default '{}'::jsonb,
  is_enabled    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_agent_registry_kind on public.agent_registry(kind);
create index if not exists idx_agent_registry_status on public.agent_registry(status);

grant select on public.agent_registry to authenticated;
grant all on public.agent_registry to service_role;

alter table public.agent_registry enable row level security;
create policy "agent_registry read for authenticated"
  on public.agent_registry for select to authenticated using (true);

-- ---------- 2) agent_threads ----------------------------------------
-- A conversation thread between user and one or more agents.
create table if not exists public.agent_threads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,                     -- founder/operator id
  project_id   text not null,                     -- 'hostflowai' | 'rapidpay' | 'founderbuilder'
  agent_slug   text not null references public.agent_registry(slug) on delete restrict,
  title        text not null default 'Untitled thread',
  message_count int not null default 0,
  last_message_at timestamptz,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_agent_threads_user on public.agent_threads(user_id, updated_at desc);
create index if not exists idx_agent_threads_project on public.agent_threads(project_id, updated_at desc);
create index if not exists idx_agent_threads_agent on public.agent_threads(agent_slug);

-- Thread messages (UIMessage-compatible parts in jsonb).
create table if not exists public.agent_thread_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.agent_threads(id) on delete cascade,
  role        public.thread_role not null,
  agent_slug  text references public.agent_registry(slug) on delete set null,
  parts       jsonb not null,                     -- UIMessage parts array
  tokens_in   int default 0,
  tokens_out  int default 0,
  model       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_agent_thread_messages_thread on public.agent_thread_messages(thread_id, created_at);

grant select, insert, update, delete on public.agent_threads to authenticated;
grant select, insert, update, delete on public.agent_thread_messages to authenticated;
grant all on public.agent_threads to service_role;
grant all on public.agent_thread_messages to service_role;

alter table public.agent_threads enable row level security;
alter table public.agent_thread_messages enable row level security;

create policy "agent_threads owner full" on public.agent_threads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "thread_messages owner full" on public.agent_thread_messages
  for all to authenticated
  using (exists (select 1 from public.agent_threads t where t.id = thread_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.agent_threads t where t.id = thread_id and t.user_id = auth.uid()));

-- ---------- 3) agent_memory -----------------------------------------
-- Long-term memory per agent (vector-ready: embedding column for pgvector).
create table if not exists public.agent_memory (
  id          uuid primary key default gen_random_uuid(),
  agent_slug  text not null references public.agent_registry(slug) on delete cascade,
  user_id     uuid,                                -- nullable: global agent memory
  project_id  text,                                -- nullable: cross-project memory
  scope       text not null default 'episodic',    -- 'episodic' | 'semantic' | 'procedural' | 'fact'
  key         text,                                -- optional unique key per scope
  content     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  -- embedding vector(1536),                       -- enable when pgvector is installed on Hetzner
  importance  smallint not null default 5,         -- 1-10
  created_at  timestamptz not null default now(),
  accessed_at timestamptz not null default now()
);
create index if not exists idx_agent_memory_agent on public.agent_memory(agent_slug, scope);
create index if not exists idx_agent_memory_user on public.agent_memory(user_id);
create index if not exists idx_agent_memory_project on public.agent_memory(project_id);

grant select, insert, update, delete on public.agent_memory to authenticated;
grant all on public.agent_memory to service_role;

alter table public.agent_memory enable row level security;

-- Owner can read/write own memory; global memory (user_id null) read-only to authenticated.
create policy "agent_memory owner full" on public.agent_memory
  for all to authenticated
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid());

-- ---------- 4) agent_activity ---------------------------------------
-- Append-only event log: every agent action for the Activity Feed.
create table if not exists public.agent_activity (
  id          uuid primary key default gen_random_uuid(),
  agent_slug  text not null references public.agent_registry(slug) on delete cascade,
  user_id     uuid,
  project_id  text,
  thread_id   uuid references public.agent_threads(id) on delete set null,
  kind        public.agent_activity_kind not null,
  summary     text not null,
  payload     jsonb not null default '{}'::jsonb,
  tokens_in   int default 0,
  tokens_out  int default 0,
  cost_usd    numeric(10,6) default 0,
  duration_ms int,
  status      public.agent_status not null default 'online',
  created_at  timestamptz not null default now()
);
create index if not exists idx_agent_activity_agent on public.agent_activity(agent_slug, created_at desc);
create index if not exists idx_agent_activity_user on public.agent_activity(user_id, created_at desc);
create index if not exists idx_agent_activity_project on public.agent_activity(project_id, created_at desc);
create index if not exists idx_agent_activity_kind on public.agent_activity(kind, created_at desc);

grant select, insert on public.agent_activity to authenticated;
grant all on public.agent_activity to service_role;

alter table public.agent_activity enable row level security;
create policy "agent_activity owner read" on public.agent_activity
  for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy "agent_activity owner insert" on public.agent_activity
  for insert to authenticated with check (user_id = auth.uid());

-- ---------- updated_at triggers -------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_agent_registry_updated on public.agent_registry;
create trigger trg_agent_registry_updated before update on public.agent_registry
  for each row execute function public.set_updated_at();

drop trigger if exists trg_agent_threads_updated on public.agent_threads;
create trigger trg_agent_threads_updated before update on public.agent_threads
  for each row execute function public.set_updated_at();

-- ---------- seed: Jimmy, Sherlock, 8 advisors, Router ---------------
insert into public.agent_registry (slug, name, role, kind, model_primary, model_fallback) values
  ('jimmy',    'Jimmy',    'Build · Design · Architect',         'supreme',  'hermes-405b',     array['qwen3-coder-480b']),
  ('sherlock', 'Sherlock', 'Review · Debug · RCA',               'supreme',  'deepseek-r1',     array['gpt-oss-120b']),
  ('aria',     'Aria',     'Beauty · Salon',                     'advisor',  'gpt-oss-120b',    array['llama-3.3-70b']),
  ('orion',    'Orion',    'Restaurant · Food',                  'advisor',  'gpt-oss-120b',    array['llama-3.3-70b']),
  ('rex',      'Rex',      'Auto · Mechanics',                   'advisor',  'gpt-oss-120b',    array['llama-3.3-70b']),
  ('lyra',     'Lyra',     'Healthcare · Clinic',                'advisor',  'gpt-oss-120b',    array['llama-3.3-70b']),
  ('sage',     'Sage',     'Legal · Advisory',                   'advisor',  'gpt-oss-120b',    array['llama-3.3-70b']),
  ('atlas',    'Atlas',    'Logistics · Fleet',                  'advisor',  'gpt-oss-120b',    array['llama-3.3-70b']),
  ('vega',     'Vega',     'Real Estate',                        'advisor',  'gpt-oss-120b',    array['llama-3.3-70b']),
  ('kai',      'Kai',      'Retail · E-commerce',                'advisor',  'gpt-oss-120b',    array['llama-3.3-70b']),
  ('router',   'Router',   'Global Routing · Cost Optimizer',    'router',   'llama-3.3-70b',   array[]::text[])
on conflict (slug) do nothing;
