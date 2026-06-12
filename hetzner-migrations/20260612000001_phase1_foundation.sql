-- ============================================================================
-- AXONETIS AI Builder™ — Phase 1 Foundation
-- Target: Supabase 3 (self-hosted Hetzner) — aiaxonetis.hostflowai.net
-- Architecture: Supabase = source of truth · TS contracts · Node/Bun runtime ·
--               OpenRouter (primary) · Groq (failover)
-- Aligned with verified server repo `hostflow-server`:
--   Bridge: bridge-orchestrator · agent-registry · realtime-sync ·
--           checksum-sync · mirror-sync
--   Gateway: openrouter · groq
--   AI: Jimmy · Sherlock · Advisors · Autonomous RapidPay
--
-- RULES (locked):
--   • No duplicate bridges, no duplicate AI layers.
--   • Mirror tables are WRITE-ONLY for service_role (bridge), READ for admins.
--   • Founder = only admin initially. RLS scoped to admin via has_role().
--   • Order: CREATE TABLE → GRANT → ENABLE RLS → POLICY.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. ROLES — app_role enum + user_roles + has_role() + founder trigger
-- ============================================================================

do $$ begin
  create type public.app_role as enum ('admin', 'founder', 'service');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all    on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "user_roles: self read"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- Founder auto-admin trigger — supports MULTIPLE locked founder emails.
-- Add/remove emails in the array below; trigger will auto-grant admin+founder
-- roles whenever any of these emails sign up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  founder_emails constant text[] := array[
    'naumansherwani@hostflowai.net',
    'naumankhansherwani@gmail.com'
  ];
begin
  if new.email = any(founder_emails) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
    insert into public.user_roles (user_id, role) values (new.id, 'founder')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any already-existing auth user whose email matches the founder
-- list gets admin+founder roles immediately (covers users created BEFORE
-- this trigger existed, e.g. naumansherwani@hostflowai.net + naumankhansherwani@gmail.com).
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where u.email in ('naumansherwani@hostflowai.net','naumankhansherwani@gmail.com')
on conflict do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'founder'::public.app_role
from auth.users u
where u.email in ('naumansherwani@hostflowai.net','naumankhansherwani@gmail.com')
on conflict do nothing;


-- ============================================================================
-- 2. PROJECTS
-- ============================================================================
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  short_name    text,
  preview_url   text,
  accent        text,
  description   text,
  owner_id      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "projects: admin full" on public.projects
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 3. PROJECT_FILES — TRUTH TABLE (hybrid: inline TEXT + storage_path)
-- ============================================================================
create table if not exists public.project_files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  path          text not null,
  content       text,
  storage_path  text,
  size_bytes    integer,
  checksum      text,
  version       integer not null default 1,
  is_deleted    boolean not null default false,
  updated_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, path)
);
create index if not exists idx_project_files_project on public.project_files(project_id);
create index if not exists idx_project_files_checksum on public.project_files(checksum);
grant select, insert, update, delete on public.project_files to authenticated;
grant all on public.project_files to service_role;
alter table public.project_files enable row level security;
create policy "project_files: admin full" on public.project_files
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 4. PROJECT_VERSIONS
-- ============================================================================
create table if not exists public.project_versions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  version_no    integer not null,
  label         text,
  snapshot      jsonb not null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (project_id, version_no)
);
create index if not exists idx_project_versions_project on public.project_versions(project_id);
grant select, insert, delete on public.project_versions to authenticated;
grant all on public.project_versions to service_role;
alter table public.project_versions enable row level security;
create policy "project_versions: admin full" on public.project_versions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 5. CHAT_MESSAGES
-- ============================================================================
create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  agent         text,
  role          text not null,
  content       text not null,
  tokens_in     integer,
  tokens_out    integer,
  model         text,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_chat_messages_project on public.chat_messages(project_id, created_at desc);
grant select, insert, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "chat_messages: admin full" on public.chat_messages
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 6. AGENT_RUNS
-- ============================================================================
create table if not exists public.agent_runs (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.projects(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  agent           text not null,
  model           text not null,
  provider        text not null,
  status          text not null default 'running',
  tokens_in       integer default 0,
  tokens_out      integer default 0,
  cost_usd        numeric(10,6) default 0,
  duration_ms     integer,
  sherlock_loop   integer default 0,
  parent_run_id   uuid references public.agent_runs(id) on delete set null,
  input           jsonb,
  output          jsonb,
  error           text,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz
);
create index if not exists idx_agent_runs_project on public.agent_runs(project_id, created_at desc);
create index if not exists idx_agent_runs_status  on public.agent_runs(status);
grant select, insert, update on public.agent_runs to authenticated;
grant all on public.agent_runs to service_role;
alter table public.agent_runs enable row level security;
create policy "agent_runs: admin full" on public.agent_runs
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 7. DEPLOYMENTS
-- ============================================================================
create table if not exists public.deployments (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  version_id      uuid references public.project_versions(id) on delete set null,
  environment     text not null default 'production',
  status          text not null default 'pending',
  url             text,
  commit_sha      text,
  triggered_by    uuid references auth.users(id) on delete set null,
  logs            jsonb default '[]'::jsonb,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);
create index if not exists idx_deployments_project on public.deployments(project_id, started_at desc);
grant select, insert, update on public.deployments to authenticated;
grant all on public.deployments to service_role;
alter table public.deployments enable row level security;
create policy "deployments: admin full" on public.deployments
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 8. AI_MODEL_REGISTRY (+ seed 6 models)
-- ============================================================================
create table if not exists public.ai_model_registry (
  id              uuid primary key default gen_random_uuid(),
  model_key       text not null unique,
  display_name    text not null,
  provider        text not null,
  vendor_model    text not null,
  role            text not null,
  tier            text,
  context_window  integer,
  input_cost_per_mtok   numeric(10,6),
  output_cost_per_mtok  numeric(10,6),
  capabilities    jsonb default '[]'::jsonb,
  is_active       boolean not null default true,
  priority        integer not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_ai_model_registry_role on public.ai_model_registry(role, priority);
grant select on public.ai_model_registry to authenticated;
grant all    on public.ai_model_registry to service_role;
alter table public.ai_model_registry enable row level security;
create policy "ai_model_registry: read auth" on public.ai_model_registry
  for select to authenticated using (true);
create policy "ai_model_registry: admin write" on public.ai_model_registry
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.ai_model_registry
  (model_key, display_name, provider, vendor_model, role, tier, context_window, capabilities, priority)
values
  ('openrouter/hermes-405b',     'Hermes 3 405B',       'openrouter', 'nousresearch/hermes-3-llama-3.1-405b', 'jimmy',    'primary',  131072, '["code","tools","reasoning"]'::jsonb, 10),
  ('openrouter/qwen3-coder-480b','Qwen3 Coder 480B',    'openrouter', 'qwen/qwen3-coder',                     'jimmy',    'primary',  262144, '["code","tools"]'::jsonb,             20),
  ('openrouter/deepseek-r1',     'DeepSeek R1',         'openrouter', 'deepseek/deepseek-r1',                 'sherlock', 'primary',  163840, '["reasoning","auto-fix"]'::jsonb,     10),
  ('openrouter/llama-3.3-70b',   'Llama 3.3 70B',       'openrouter', 'meta-llama/llama-3.3-70b-instruct',    'router',   'router',   131072, '["routing","fast"]'::jsonb,           10),
  ('groq/llama-3.3-70b',         'Llama 3.3 70B (Groq)','groq',        'llama-3.3-70b-versatile',              'sherlock', 'failover', 131072, '["fast","failover"]'::jsonb,          50),
  ('groq/gpt-oss-120b',          'GPT-OSS 120B (Groq)', 'groq',        'openai/gpt-oss-120b',                  'jimmy',    'failover', 131072, '["fast","failover"]'::jsonb,          60)
on conflict (model_key) do nothing;

-- ============================================================================
-- 8b. AI_AGENT_IDENTITIES — Jimmy / Sherlock / 8 Advisors / Autonomous RapidPay
-- Each identity has a default model + fallback chain, referencing ai_model_registry.
-- ============================================================================
create table if not exists public.ai_agent_identities (
  id                    uuid primary key default gen_random_uuid(),
  identity_key          text not null unique,
  display_name          text not null,
  role                  text not null,          -- jimmy | sherlock | advisor | rapidpay
  industry              text,                   -- advisors only
  default_model_key     text not null references public.ai_model_registry(model_key),
  failover_model_keys   text[] not null default '{}',
  system_prompt         text,
  capabilities          jsonb not null default '[]'::jsonb,
  is_active             boolean not null default true,
  priority              integer not null default 100,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_ai_agent_identities_role on public.ai_agent_identities(role);

grant select on public.ai_agent_identities to authenticated;
grant all    on public.ai_agent_identities to service_role;
alter table public.ai_agent_identities enable row level security;
create policy "ai_agent_identities: read auth" on public.ai_agent_identities
  for select to authenticated using (true);
create policy "ai_agent_identities: admin write" on public.ai_agent_identities
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger for ai_agent_identities is created in the trigger section at the bottom.


insert into public.ai_agent_identities
  (identity_key, display_name, role, industry, default_model_key, failover_model_keys, capabilities, priority)
values
  -- Core builder agents
  ('jimmy',                 'Jimmy — Builder Lead',          'jimmy',    null,
     'openrouter/hermes-405b',
     array['openrouter/qwen3-coder-480b','groq/gpt-oss-120b'],
     '["code-gen","planning","tools","multi-file-edit"]'::jsonb, 10),

  ('sherlock',              'Sherlock — Auto-Fix & Reasoning','sherlock', null,
     'openrouter/deepseek-r1',
     array['groq/llama-3.3-70b','openrouter/llama-3.3-70b'],
     '["reasoning","auto-fix","error-diagnosis","max-3-loops"]'::jsonb, 10),

  -- 8 Industry Advisors (HostFlow industries)
  ('advisor_hospitality',   'Advisor — Hospitality',         'advisor',  'hospitality',
     'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'],
     '["domain-knowledge","recommendations"]'::jsonb, 50),
  ('advisor_restaurants',   'Advisor — Restaurants',         'advisor',  'restaurants',
     'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'],
     '["domain-knowledge","recommendations"]'::jsonb, 50),
  ('advisor_retail',        'Advisor — Retail',              'advisor',  'retail',
     'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'],
     '["domain-knowledge","recommendations"]'::jsonb, 50),
  ('advisor_healthcare',    'Advisor — Healthcare',          'advisor',  'healthcare',
     'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'],
     '["domain-knowledge","recommendations"]'::jsonb, 50),
  ('advisor_realestate',    'Advisor — Real Estate',         'advisor',  'realestate',
     'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'],
     '["domain-knowledge","recommendations"]'::jsonb, 50),
  ('advisor_education',     'Advisor — Education',           'advisor',  'education',
     'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'],
     '["domain-knowledge","recommendations"]'::jsonb, 50),
  ('advisor_automotive',    'Advisor — Automotive',          'advisor',  'automotive',
     'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'],
     '["domain-knowledge","recommendations"]'::jsonb, 50),
  ('advisor_professional',  'Advisor — Professional Services','advisor', 'professional',
     'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'],
     '["domain-knowledge","recommendations"]'::jsonb, 50),

  -- Autonomous Rapid Pay
  ('rapidpay_autonomous',   'Autonomous RapidPay',           'rapidpay', null,
     'openrouter/qwen3-coder-480b',
     array['openrouter/hermes-405b','groq/gpt-oss-120b'],
     '["payments","ledger","autonomous-ops","state-sync"]'::jsonb, 10)
on conflict (identity_key) do nothing;



-- ============================================================================
-- 9. MIRROR_SYNC_LOG
-- ============================================================================
create table if not exists public.mirror_sync_log (
  id              uuid primary key default gen_random_uuid(),
  source_system   text not null,
  source_table    text not null,
  mirror_table    text not null,
  records_synced  integer not null default 0,
  records_failed  integer not null default 0,
  checksum_before text,
  checksum_after  text,
  status          text not null default 'ok',
  duration_ms     integer,
  details         jsonb default '{}'::jsonb,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);
create index if not exists idx_mirror_sync_log_table on public.mirror_sync_log(mirror_table, started_at desc);
grant select on public.mirror_sync_log to authenticated;
grant all    on public.mirror_sync_log to service_role;
alter table public.mirror_sync_log enable row level security;
create policy "mirror_sync_log: admin read" on public.mirror_sync_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 10. MIRROR TABLES (7) — HYBRID: typed indexable cols + payload JSONB
-- Written ONLY by bridge (service_role). Authenticated admins read.
-- ============================================================================

create table if not exists public.mirror_ai_agents (
  id uuid primary key default gen_random_uuid(),
  source_record_id text not null,
  source_system    text not null,
  agent_name       text,
  agent_type       text,
  status           text,
  checksum         text not null,
  synced_at        timestamptz not null default now(),
  payload          jsonb not null,
  unique (source_system, source_record_id)
);
create index if not exists idx_mirror_ai_agents_name on public.mirror_ai_agents(agent_name);
grant select on public.mirror_ai_agents to authenticated;
grant all    on public.mirror_ai_agents to service_role;
alter table public.mirror_ai_agents enable row level security;
create policy "mirror_ai_agents: admin read" on public.mirror_ai_agents
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table if not exists public.mirror_ai_registry (
  id uuid primary key default gen_random_uuid(),
  source_record_id text not null,
  source_system    text not null,
  model_key        text,
  provider         text,
  status           text,
  checksum         text not null,
  synced_at        timestamptz not null default now(),
  payload          jsonb not null,
  unique (source_system, source_record_id)
);
create index if not exists idx_mirror_ai_registry_model on public.mirror_ai_registry(model_key);
grant select on public.mirror_ai_registry to authenticated;
grant all    on public.mirror_ai_registry to service_role;
alter table public.mirror_ai_registry enable row level security;
create policy "mirror_ai_registry: admin read" on public.mirror_ai_registry
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table if not exists public.mirror_ai_configurations (
  id uuid primary key default gen_random_uuid(),
  source_record_id text not null,
  source_system    text not null,
  config_key       text,
  scope            text,
  status           text,
  checksum         text not null,
  synced_at        timestamptz not null default now(),
  payload          jsonb not null,
  unique (source_system, source_record_id)
);
create index if not exists idx_mirror_ai_configurations_key on public.mirror_ai_configurations(config_key);
grant select on public.mirror_ai_configurations to authenticated;
grant all    on public.mirror_ai_configurations to service_role;
alter table public.mirror_ai_configurations enable row level security;
create policy "mirror_ai_configurations: admin read" on public.mirror_ai_configurations
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table if not exists public.mirror_industry_advisors (
  id uuid primary key default gen_random_uuid(),
  source_record_id text not null,
  source_system    text not null,
  advisor_name     text,
  industry         text,
  status           text,
  checksum         text not null,
  synced_at        timestamptz not null default now(),
  payload          jsonb not null,
  unique (source_system, source_record_id)
);
create index if not exists idx_mirror_industry_advisors_ind on public.mirror_industry_advisors(industry);
grant select on public.mirror_industry_advisors to authenticated;
grant all    on public.mirror_industry_advisors to service_role;
alter table public.mirror_industry_advisors enable row level security;
create policy "mirror_industry_advisors: admin read" on public.mirror_industry_advisors
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table if not exists public.mirror_runtime_features (
  id uuid primary key default gen_random_uuid(),
  source_record_id text not null,
  source_system    text not null,
  feature_name     text,
  feature_status   text,
  checksum         text not null,
  synced_at        timestamptz not null default now(),
  payload          jsonb not null,
  unique (source_system, source_record_id)
);
create index if not exists idx_mirror_runtime_features_name on public.mirror_runtime_features(feature_name);
grant select on public.mirror_runtime_features to authenticated;
grant all    on public.mirror_runtime_features to service_role;
alter table public.mirror_runtime_features enable row level security;
create policy "mirror_runtime_features: admin read" on public.mirror_runtime_features
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table if not exists public.mirror_agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  source_record_id text not null,
  source_system    text not null,
  agent_name       text,
  capability       text,
  status           text,
  checksum         text not null,
  synced_at        timestamptz not null default now(),
  payload          jsonb not null,
  unique (source_system, source_record_id)
);
create index if not exists idx_mirror_agent_capabilities_pair on public.mirror_agent_capabilities(agent_name, capability);
grant select on public.mirror_agent_capabilities to authenticated;
grant all    on public.mirror_agent_capabilities to service_role;
alter table public.mirror_agent_capabilities enable row level security;
create policy "mirror_agent_capabilities: admin read" on public.mirror_agent_capabilities
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table if not exists public.mirror_sync_registry (
  id uuid primary key default gen_random_uuid(),
  source_record_id text not null,
  source_system    text not null,
  stream_name      text not null,
  last_status      text,
  last_checksum    text,
  health           text default 'unknown',
  checksum         text not null,
  synced_at        timestamptz not null default now(),
  payload          jsonb not null,
  unique (source_system, stream_name)
);
create index if not exists idx_mirror_sync_registry_health on public.mirror_sync_registry(health);
grant select on public.mirror_sync_registry to authenticated;
grant all    on public.mirror_sync_registry to service_role;
alter table public.mirror_sync_registry enable row level security;
create policy "mirror_sync_registry: admin read" on public.mirror_sync_registry
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 11. REALTIME PUBLICATION
-- ============================================================================
alter publication supabase_realtime add table public.project_files;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.agent_runs;

-- ============================================================================
-- updated_at auto-touch
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_projects_touch              on public.projects;
drop trigger if exists trg_project_files_touch         on public.project_files;
drop trigger if exists trg_ai_model_registry_touch     on public.ai_model_registry;
drop trigger if exists trg_ai_agent_identities_touch   on public.ai_agent_identities;

create trigger trg_projects_touch              before update on public.projects              for each row execute function public.touch_updated_at();
create trigger trg_project_files_touch         before update on public.project_files         for each row execute function public.touch_updated_at();
create trigger trg_ai_model_registry_touch     before update on public.ai_model_registry     for each row execute function public.touch_updated_at();
create trigger trg_ai_agent_identities_touch   before update on public.ai_agent_identities   for each row execute function public.touch_updated_at();

-- ============================================================================
-- END Phase 1
-- ============================================================================
