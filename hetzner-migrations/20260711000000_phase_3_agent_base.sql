-- =====================================================================
-- AXONETIS™ Builder — Phase 3 dependency bootstrap
-- Target: self-hosted AXONETIS DB. Safe/idempotent.
-- Purpose: ensure base project + agent tables exist before 3.9.3→3.9.7.
-- IMPORTANT: CREATE TABLE → GRANT → ENABLE RLS → POLICY.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Plain Postgres compatibility mode.
-- Important: on a real Auth DB, the `auth` schema is owned by the auth system;
-- non-owner DB users can read `auth.users` but cannot CREATE in that schema.
-- Therefore never run direct IF-NOT-EXISTS DDL for auth.users: even
-- when the table already exists, Postgres may still check schema CREATE rights.
do $bootstrap_auth$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    begin
      execute 'create schema auth';
    exception when insufficient_privilege then
      raise exception 'auth schema missing aur current DB user ke paas CREATE SCHEMA privilege nahi. Superuser/direct self-hosted DB user use karo.';
    end;
  end if;

  begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'create role authenticated';
    end if;
  exception when insufficient_privilege then
    raise notice 'Role authenticated create karne ki permission nahi; assuming real Auth DB already manages roles.';
  end;

  begin
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      execute 'create role service_role';
    end if;
  exception when insufficient_privilege then
    raise notice 'Role service_role create karne ki permission nahi; assuming real Auth DB already manages roles.';
  end;

  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      execute 'create role anon';
    end if;
  exception when insufficient_privilege then
    raise notice 'Role anon create karne ki permission nahi; assuming real Auth DB already manages roles.';
  end;

  if to_regclass('auth.users') is null then
    begin
      execute $sql$
        create table auth.users (
          id uuid primary key default gen_random_uuid(),
          email text unique,
          created_at timestamptz not null default now()
        )
      $sql$;
    exception when insufficient_privilege then
      raise exception 'auth.users missing hai aur current DB user auth schema mein table create nahi kar sakta. Correct direct DB superuser URL do, ya local peer postgres fallback use karo.';
    end;
  end if;

  if to_regprocedure('auth.uid()') is null then
    begin
      execute $sql$
        create function auth.uid()
        returns uuid
        language sql
        stable
        as $fn$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $fn$
      $sql$;
    exception when insufficient_privilege then
      raise exception 'auth.uid() missing hai aur current DB user auth schema mein function create nahi kar sakta. Correct direct DB superuser URL do, ya local peer postgres fallback use karo.';
    end;
  end if;
end
$bootstrap_auth$;

do $$ begin
  create type public.app_role as enum ('admin', 'founder', 'service');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
drop policy if exists "user_roles: self read" on public.user_roles;
create policy "user_roles: self read" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  preview_url text,
  accent text,
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
drop policy if exists "projects: admin full" on public.projects;
create policy "projects: admin full" on public.projects
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  content text,
  storage_path text,
  size_bytes integer,
  checksum text,
  version integer not null default 1,
  is_deleted boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);
create index if not exists idx_project_files_project on public.project_files(project_id);
create index if not exists idx_project_files_checksum on public.project_files(checksum);
grant select, insert, update, delete on public.project_files to authenticated;
grant all on public.project_files to service_role;
alter table public.project_files enable row level security;
drop policy if exists "project_files: admin full" on public.project_files;
create policy "project_files: admin full" on public.project_files
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  agent text not null,
  model text not null default 'router',
  provider text not null default 'axonetis-loop',
  status text not null default 'running',
  tokens_in integer default 0,
  tokens_out integer default 0,
  cost_usd numeric(10,6) default 0,
  duration_ms integer,
  sherlock_loop integer default 0,
  parent_run_id uuid references public.agent_runs(id) on delete set null,
  input jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_agent_runs_project on public.agent_runs(project_id, created_at desc);
create index if not exists idx_agent_runs_status on public.agent_runs(status);
grant select, insert, update on public.agent_runs to authenticated;
grant all on public.agent_runs to service_role;
alter table public.agent_runs enable row level security;
drop policy if exists "agent_runs: admin full" on public.agent_runs;
create policy "agent_runs: admin full" on public.agent_runs
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.agent_registry (
  slug text primary key,
  name text not null,
  role text not null,
  kind text not null check (kind in ('supreme','advisor','rapidpay','router')),
  model_primary text not null,
  model_fallback text[] not null default '{}',
  routing_config jsonb not null default '{}'::jsonb,
  status text not null default 'online' check (status in ('online','thinking','idle','offline','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agent_registry to authenticated;
grant all on public.agent_registry to service_role;
alter table public.agent_registry enable row level security;
drop policy if exists "agent_registry: read auth" on public.agent_registry;
create policy "agent_registry: read auth" on public.agent_registry
  for select to authenticated using (true);
drop policy if exists "agent_registry: admin write" on public.agent_registry;
create policy "agent_registry: admin write" on public.agent_registry
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.agent_registry (slug, name, role, kind, model_primary, model_fallback, routing_config, status)
values
  ('jimmy', 'Jimmy — Builder Lead', 'build', 'supreme', 'openrouter/hermes-405b', array['openrouter/qwen3-coder-480b','groq/gpt-oss-120b'], '{"primary":{"provider":"openrouter","models":["nousresearch/hermes-3-llama-3.1-405b","qwen/qwen3-coder"]},"secondary":{"provider":"groq","mode":"speed_acceleration","models":["openai/gpt-oss-120b"]},"memory_target_messages":3000000}'::jsonb, 'online'),
  ('sherlock', 'Sherlock — Audit Deputy', 'audit', 'supreme', 'openrouter/deepseek-r1', array['groq/llama-3.3-70b','openrouter/llama-3.3-70b'], '{"primary":{"provider":"openrouter","models":["deepseek/deepseek-r1"]},"secondary":{"provider":"groq","mode":"speed_acceleration","models":["llama-3.3-70b-versatile"]},"memory_target_messages":1000000}'::jsonb, 'online'),
  ('aria', 'Aria — Hospitality Advisor', 'advisor', 'advisor', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online'),
  ('orion', 'Orion — Restaurant Advisor', 'advisor', 'advisor', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online'),
  ('rex', 'Rex — Retail Advisor', 'advisor', 'advisor', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online'),
  ('lyra', 'Lyra — Healthcare Advisor', 'advisor', 'advisor', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online'),
  ('sage', 'Sage — Real Estate Advisor', 'advisor', 'advisor', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online'),
  ('atlas', 'Atlas — Education Advisor', 'advisor', 'advisor', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online'),
  ('vega', 'Vega — Automotive Advisor', 'advisor', 'advisor', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online'),
  ('kai', 'Kai — Professional Services Advisor', 'advisor', 'advisor', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online'),
  ('router', 'Global Router', 'router', 'router', 'openrouter/llama-3.3-70b', array['groq/llama-3.3-70b'], '{}'::jsonb, 'online')
on conflict (slug) do update set
  name = excluded.name,
  role = excluded.role,
  kind = excluded.kind,
  model_primary = excluded.model_primary,
  model_fallback = excluded.model_fallback,
  routing_config = excluded.routing_config,
  status = excluded.status,
  updated_at = now();

create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  agent_slug text not null,
  title text not null default 'Untitled',
  user_id uuid references auth.users(id) on delete set null,
  message_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agent_threads_project on public.agent_threads(project_id, updated_at desc);
create index if not exists idx_agent_threads_agent on public.agent_threads(agent_slug, updated_at desc);
grant select, insert, update, delete on public.agent_threads to authenticated;
grant all on public.agent_threads to service_role;
alter table public.agent_threads enable row level security;
drop policy if exists "agent_threads: admin full" on public.agent_threads;
create policy "agent_threads: admin full" on public.agent_threads
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.agent_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agent_threads(id) on delete cascade,
  parent_message_id uuid references public.agent_thread_messages(id) on delete set null,
  role text not null check (role in ('user','agent','system','tool')),
  agent_slug text,
  parts jsonb not null default '[]'::jsonb,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  model text,
  cost_usd numeric(12,6),
  saved_vs_default_usd numeric(12,6),
  default_model text,
  loop_iteration integer,
  audit_status text,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_thread_messages_thread on public.agent_thread_messages(thread_id, created_at);
create index if not exists idx_agent_thread_messages_parent on public.agent_thread_messages(parent_message_id);
grant select, insert, update, delete on public.agent_thread_messages to authenticated;
grant all on public.agent_thread_messages to service_role;
alter table public.agent_thread_messages enable row level security;
drop policy if exists "agent_thread_messages: admin full" on public.agent_thread_messages;
create policy "agent_thread_messages: admin full" on public.agent_thread_messages
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.bump_agent_thread_message_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agent_threads
     set message_count = message_count + 1,
         last_message_at = new.created_at,
         updated_at = now()
   where id = new.thread_id;
  return new;
end;
$$;
drop trigger if exists agent_thread_messages_bump_thread on public.agent_thread_messages;
create trigger agent_thread_messages_bump_thread
  after insert on public.agent_thread_messages
  for each row execute function public.bump_agent_thread_message_count();
grant execute on function public.bump_agent_thread_message_count() to authenticated, service_role;

create table if not exists public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  agent_slug text not null,
  project_id text,
  thread_id uuid references public.agent_threads(id) on delete set null,
  kind text not null default 'chat',
  summary text not null default '',
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_usd numeric(12,6) not null default 0,
  duration_ms integer,
  status text not null default 'online' check (status in ('online','thinking','idle','offline','error')),
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_activity_project on public.agent_activity(project_id, created_at desc);
create index if not exists idx_agent_activity_agent on public.agent_activity(agent_slug, created_at desc);
grant select, insert, update, delete on public.agent_activity to authenticated;
grant all on public.agent_activity to service_role;
alter table public.agent_activity enable row level security;
drop policy if exists "agent_activity: admin full" on public.agent_activity;
create policy "agent_activity: admin full" on public.agent_activity
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_slug text not null,
  project_id text,
  scope text not null check (scope in ('episodic','semantic','procedural','fact')),
  key text,
  content text not null,
  importance numeric(4,3) not null default 0.5,
  created_at timestamptz not null default now(),
  accessed_at timestamptz not null default now()
);
create index if not exists idx_agent_memory_agent_scope on public.agent_memory(agent_slug, scope, importance desc);
create index if not exists idx_agent_memory_project on public.agent_memory(project_id);
grant select, insert, update, delete on public.agent_memory to authenticated;
grant all on public.agent_memory to service_role;
alter table public.agent_memory enable row level security;
drop policy if exists "agent_memory: admin full" on public.agent_memory;
create policy "agent_memory: admin full" on public.agent_memory
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));