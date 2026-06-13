-- ============================================================
-- ⚠️ YEH SUPABASE 3 SQL HAI (Phase 5 — Preview Engine)
-- Paste in: Supabase 3 SQL editor (founder ke self-hosted instance)
-- Idempotent: safely re-runnable.
-- ============================================================

-- 1) Enum: preview_env
do $$
begin
  create type public.preview_env as enum ('sandbox', 'production');
exception when duplicate_object then null;
end $$;

-- 2) Enum: preview_status
do $$
begin
  create type public.preview_status as enum ('starting', 'ready', 'stale', 'error');
exception when duplicate_object then null;
end $$;

-- 3) Enum: project_file_change
do $$
begin
  create type public.project_file_change as enum ('create', 'update', 'delete');
exception when duplicate_object then null;
end $$;

-- 4) Table: project_files (the truth — AI writes here, preview reads here)
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  env public.preview_env not null default 'sandbox',
  branch text not null default 'main',
  path text not null,
  content text,
  checksum text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, env, branch, path)
);

create index if not exists project_files_project_env_idx
  on public.project_files (project_id, env, branch);

create index if not exists project_files_updated_at_idx
  on public.project_files (updated_at desc);

-- 5) Table: preview_sessions
create table if not exists public.preview_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  env public.preview_env not null,
  branch text not null default 'main',
  preview_url text not null,
  status public.preview_status not null default 'starting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, env, branch)
);

create index if not exists preview_sessions_project_env_idx
  on public.preview_sessions (project_id, env);

-- 6) Auto-update updated_at trigger fn (shared)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists project_files_set_updated_at on public.project_files;
create trigger project_files_set_updated_at
  before update on public.project_files
  for each row execute function public.set_updated_at();

drop trigger if exists preview_sessions_set_updated_at on public.preview_sessions;
create trigger preview_sessions_set_updated_at
  before update on public.preview_sessions
  for each row execute function public.set_updated_at();

-- 7) Grants (Supabase Data API needs explicit grants)
grant select on public.project_files to authenticated;
grant all on public.project_files to service_role;
grant select on public.preview_sessions to authenticated;
grant all on public.preview_sessions to service_role;

-- 8) RLS — authenticated can read only; writes go via service_role (server)
alter table public.project_files enable row level security;
alter table public.preview_sessions enable row level security;

drop policy if exists project_files_read on public.project_files;
create policy project_files_read
  on public.project_files for select
  to authenticated
  using (true);

drop policy if exists preview_sessions_read on public.preview_sessions;
create policy preview_sessions_read
  on public.preview_sessions for select
  to authenticated
  using (true);

-- 9) Enable Realtime on project_files (so frontend Hot Reload works)
do $$
begin
  alter publication supabase_realtime add table public.project_files;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.preview_sessions;
exception when duplicate_object then null;
end $$;
