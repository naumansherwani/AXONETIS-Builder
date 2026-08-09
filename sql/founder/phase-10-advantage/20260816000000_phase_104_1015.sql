-- Phase 10.4 → 10.15 — Advantage Layer canonical schema (Supabase 3)
-- Idempotent. Run once in Supabase 3 SQL editor.

-- 10.4 Screenshot Vision -----------------------------------------------------
create table if not exists public.vision_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  file_path text,
  width int, height int,
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);
create table if not exists public.vision_suggestions (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.vision_uploads(id) on delete cascade,
  project_id text not null,
  idx int not null default 0,
  title text, detail text, target_file text, patch text,
  box jsonb,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

-- 10.5 Multiplayer presence --------------------------------------------------
create table if not exists public.presence_activity (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  actor text not null,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);

-- 10.6 AI test generator -----------------------------------------------------
create table if not exists public.project_tests (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  file_path text not null,
  source text not null default 'generated',
  status text not null default 'pending',
  coverage numeric,
  duration_ms int,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  test_id uuid references public.project_tests(id) on delete cascade,
  status text not null,
  passed int default 0, failed int default 0,
  coverage numeric,
  output text,
  created_at timestamptz not null default now()
);

-- 10.8 Browser-use agent -----------------------------------------------------
create table if not exists public.browser_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  url text not null,
  status text not null default 'running',
  supervised boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create table if not exists public.browser_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.browser_sessions(id) on delete cascade,
  kind text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- 10.10 One-prompt full-stack ------------------------------------------------
create table if not exists public.fullstack_builds (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  prompt text not null,
  status text not null default 'planning',
  live_url text,
  eta_seconds int,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create table if not exists public.fullstack_tasks (
  id uuid primary key default gen_random_uuid(),
  build_id uuid references public.fullstack_builds(id) on delete cascade,
  idx int not null default 0,
  title text not null,
  worker int not null default 0,
  status text not null default 'queued',
  progress int not null default 0,
  created_at timestamptz not null default now()
);

-- 10.11 Auto-migration runner ------------------------------------------------
create table if not exists public.migration_backups (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  tables text[] not null default '{}',
  snapshot jsonb,
  schema_before text,
  created_at timestamptz not null default now()
);
create table if not exists public.schema_migrations_log (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  sql text not null,
  status text not null default 'applied',
  affected_rows int,
  backup_id uuid references public.migration_backups(id) on delete set null,
  schema_before text,
  schema_after text,
  error text,
  applied_at timestamptz not null default now()
);

-- 10.12 Industry advisor router ---------------------------------------------
create table if not exists public.advisor_answers (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  advisor text not null,
  domain text,
  model text,
  prompt text,
  answer text,
  created_at timestamptz not null default now()
);

-- 10.13 Founder sandbox ------------------------------------------------------
create table if not exists public.project_envs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  kind text not null default 'production',
  active boolean not null default true,
  row_count int,
  reset_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.project_envs add column if not exists active boolean not null default true;
alter table public.project_envs add column if not exists row_count int;
alter table public.project_envs add column if not exists reset_at timestamptz;
alter table public.project_envs add column if not exists expires_at timestamptz;
do $$ begin
  create unique index project_envs_project_kind_key on public.project_envs(project_id, kind);
exception when duplicate_table or duplicate_object then null; end $$;

create table if not exists public.sandbox_files (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  path text not null,
  content text,
  updated_at timestamptz not null default now()
);
create table if not exists public.sandbox_rows (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  table_name text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- 10.14 Explainability (columns on existing tables) --------------------------
alter table public.agent_thread_messages add column if not exists model text;
alter table public.agent_thread_messages add column if not exists tokens_in int;
alter table public.agent_thread_messages add column if not exists tokens_out int;
alter table public.agent_thread_messages add column if not exists cost_usd numeric;
alter table public.tool_call_registry add column if not exists message_id uuid;
alter table public.tool_call_registry add column if not exists duration_ms int;

-- 10.15 Command center (revenue source) -------------------------------------
alter table public.outreach_leads add column if not exists mrr_usd numeric;
alter table public.outreach_leads add column if not exists closed_at timestamptz;

-- Indexes -------------------------------------------------------------------
create index if not exists vision_suggestions_project_idx on public.vision_suggestions(project_id, created_at desc);
create index if not exists presence_activity_project_idx on public.presence_activity(project_id, created_at desc);
create index if not exists project_tests_project_idx on public.project_tests(project_id);
create index if not exists browser_actions_session_idx on public.browser_actions(session_id, created_at);
create index if not exists fullstack_tasks_build_idx on public.fullstack_tasks(build_id, idx);
create index if not exists schema_migrations_log_project_idx on public.schema_migrations_log(project_id, applied_at desc);
create index if not exists advisor_answers_project_idx on public.advisor_answers(project_id, created_at desc);
create index if not exists tool_call_registry_message_idx on public.tool_call_registry(message_id);

-- Grants + RLS (founder-only surface: service_role writes, authenticated reads)
do $$
declare t text;
begin
  foreach t in array array[
    'vision_uploads','vision_suggestions','presence_activity','project_tests','test_runs',
    'browser_sessions','browser_actions','fullstack_builds','fullstack_tasks',
    'migration_backups','schema_migrations_log','advisor_answers','project_envs',
    'sandbox_files','sandbox_rows'
  ]
  loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    begin
      execute format(
        'create policy %I on public.%I for select to authenticated using (true)',
        t || '_read', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
