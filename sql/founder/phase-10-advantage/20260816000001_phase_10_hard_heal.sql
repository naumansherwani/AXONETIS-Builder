-- Phase 10 — HARD HEAL (100%, not "parity")
-- Safe to run any number of times. Never errors on missing prerequisite tables:
-- every ALTER is guarded by an existence check, and missing base tables are created.
-- Run AFTER 20260816000000_phase_104_1015.sql (or standalone — it heals both ways).

-- ---------------------------------------------------------------------------
-- 0) Helper: add a column only if its table exists
-- ---------------------------------------------------------------------------
create or replace function public.fb_add_col(_table text, _col text, _type text)
returns void language plpgsql as $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = _table
  ) then
    execute format('alter table public.%I add column if not exists %I %s', _table, _col, _type);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Prerequisite tables (created only if a previous phase never ran)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid,
  project_id text,
  role text not null default 'assistant',
  content text,
  created_at timestamptz not null default now()
);

create table if not exists public.tool_call_registry (
  id uuid primary key default gen_random_uuid(),
  project_id text,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'pending',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.outreach_leads (
  id uuid primary key default gen_random_uuid(),
  project_id text,
  company text,
  contact_name text,
  email text,
  stage text not null default 'new',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) Guarded column heals (10.14 explainability + 10.15 command center)
-- ---------------------------------------------------------------------------
select public.fb_add_col('agent_thread_messages', 'model',      'text');
select public.fb_add_col('agent_thread_messages', 'tokens_in',  'int');
select public.fb_add_col('agent_thread_messages', 'tokens_out', 'int');
select public.fb_add_col('agent_thread_messages', 'cost_usd',   'numeric');
select public.fb_add_col('agent_thread_messages', 'parent_message_id', 'uuid');

select public.fb_add_col('tool_call_registry', 'message_id',  'uuid');
select public.fb_add_col('tool_call_registry', 'duration_ms', 'int');
select public.fb_add_col('tool_call_registry', 'started_at',  'timestamptz default now()');
select public.fb_add_col('tool_call_registry', 'finished_at', 'timestamptz');

select public.fb_add_col('outreach_leads', 'mrr_usd',   'numeric');
select public.fb_add_col('outreach_leads', 'closed_at', 'timestamptz');

-- ---------------------------------------------------------------------------
-- 3) Phase 10 table column heals (legacy-shape tolerant)
-- ---------------------------------------------------------------------------
select public.fb_add_col('vision_shots',     'bytes',       'bigint');
select public.fb_add_col('vision_shots',     'width',       'int');
select public.fb_add_col('vision_shots',     'height',      'int');
select public.fb_add_col('vision_shots',     'analyzed_at', 'timestamptz');
select public.fb_add_col('vision_analyses',  'model',       'text');
select public.fb_add_col('vision_analyses',  'summary',     'text');
select public.fb_add_col('vision_analyses',  'elements',    "jsonb default '[]'::jsonb");
select public.fb_add_col('vision_analyses',  'suggestions', "jsonb default '[]'::jsonb");

select public.fb_add_col('presence_activity','target',      'text');

select public.fb_add_col('test_files',       'origin',      "text default 'generated'");
select public.fb_add_col('test_files',       'total',       'int default 0');
select public.fb_add_col('test_files',       'passed',      'int default 0');
select public.fb_add_col('test_files',       'failed',      'int default 0');
select public.fb_add_col('test_files',       'duration_ms', 'int');
select public.fb_add_col('test_runs',        'actor',       "text default 'sherlock'");
select public.fb_add_col('test_runs',        'duration_ms', 'int');
select public.fb_add_col('test_runs',        'log',         'text');
select public.fb_add_col('test_runs',        'coverage',    'numeric');

select public.fb_add_col('browser_sessions', 'goal',        'text');
select public.fb_add_col('browser_sessions', 'supervised',  'boolean default true');
select public.fb_add_col('browser_sessions', 'ended_at',    'timestamptz');
select public.fb_add_col('browser_actions',  'project_id',  'text');
select public.fb_add_col('browser_actions',  'selector',    'text');
select public.fb_add_col('browser_actions',  'detail',      'text');

select public.fb_add_col('fullstack_builds', 'phase',       "text default 'planning'");
select public.fb_add_col('fullstack_builds', 'live_url',    'text');
select public.fb_add_col('fullstack_builds', 'eta_seconds', 'int');
select public.fb_add_col('fullstack_builds', 'duration_ms', 'int');
select public.fb_add_col('fullstack_builds', 'finished_at', 'timestamptz');
select public.fb_add_col('fullstack_tasks',  'project_id',  'text');
select public.fb_add_col('fullstack_tasks',  'state',       "text default 'queued'");
select public.fb_add_col('fullstack_tasks',  'status',      "text default 'queued'");
select public.fb_add_col('fullstack_tasks',  'progress',    'int default 0');
select public.fb_add_col('fullstack_tasks',  'worker',      'int');
select public.fb_add_col('fullstack_tasks',  'idx',         'int default 0');

select public.fb_add_col('migration_backups','snapshot',      'jsonb');
select public.fb_add_col('migration_backups','schema_before', 'text');
select public.fb_add_col('schema_migrations_log','affected_rows','int');
select public.fb_add_col('schema_migrations_log','schema_before','text');
select public.fb_add_col('schema_migrations_log','schema_after', 'text');
select public.fb_add_col('schema_migrations_log','error',        'text');

select public.fb_add_col('advisor_answers',  'domain',      'text');
select public.fb_add_col('advisor_answers',  'model',       'text');
select public.fb_add_col('advisor_answers',  'prompt',      'text');
select public.fb_add_col('advisor_answers',  'answer',      'text');

select public.fb_add_col('project_envs',     'active',      'boolean default true');
select public.fb_add_col('project_envs',     'row_count',   'int');
select public.fb_add_col('project_envs',     'reset_at',    'timestamptz');
select public.fb_add_col('project_envs',     'expires_at',  'timestamptz');

select public.fb_add_col('sandbox_files',    'content',     'text');
select public.fb_add_col('sandbox_rows',     'payload',     'jsonb');

-- ---------------------------------------------------------------------------
-- 4) Grants + RLS for every Phase 10 table that exists
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'vision_shots','vision_analyses','presence_activity','test_files','test_runs',
    'browser_sessions','browser_actions','fullstack_builds','fullstack_tasks',
    'migration_backups','schema_migrations_log','advisor_answers','project_envs',
    'sandbox_files','sandbox_rows','agent_thread_messages','tool_call_registry',
    'outreach_leads'
  ]
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t) then
      execute format('grant select on public.%I to authenticated', t);
      execute format('grant all on public.%I to service_role', t);
      execute format('alter table public.%I enable row level security', t);
      begin
        execute format(
          'create policy %I on public.%I for select to authenticated using (true)',
          t || '_read', t);
      exception when duplicate_object then null; end;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Indexes (only when the table exists)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tool_call_registry') then
    execute 'create index if not exists tool_call_registry_message_idx on public.tool_call_registry(message_id)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='agent_thread_messages') then
    execute 'create index if not exists agent_thread_messages_parent_idx on public.agent_thread_messages(parent_message_id)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='outreach_leads') then
    execute 'create index if not exists outreach_leads_closed_idx on public.outreach_leads(closed_at desc)';
  end if;
end $$;
