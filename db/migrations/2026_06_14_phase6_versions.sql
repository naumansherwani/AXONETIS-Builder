-- ============================================================
-- ⚠️ YEH SUPABASE 3 SQL HAI (Phase 6 — Version Control & Recovery)
-- Paste in: Supabase 3 SQL editor (founder ke self-hosted instance)
-- Idempotent: safely re-runnable.
--
-- Tables:
--   file_versions     — every project_files write snapshots here (truth log)
--   deployments       — sandbox→production publish history (with diff summary)
--   rollback_history  — every restore action (audit trail)
-- ============================================================

-- 1) Enum: deployment_status
do $$
begin
  create type public.deployment_status as enum ('pending', 'building', 'live', 'failed', 'rolled_back');
exception when duplicate_object then null;
end $$;

-- 2) Enum: rollback_scope
do $$
begin
  create type public.rollback_scope as enum ('file', 'deployment', 'project');
exception when duplicate_object then null;
end $$;

-- 3) file_versions — append-only snapshot of every project_files mutation
create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  env public.preview_env not null default 'sandbox',
  branch text not null default 'main',
  path text not null,
  content text,
  checksum text,
  change public.project_file_change not null,
  parent_version_id uuid references public.file_versions(id) on delete set null,
  message text,
  author text,
  created_at timestamptz not null default now()
);

create index if not exists file_versions_lookup_idx
  on public.file_versions (project_id, env, branch, path, created_at desc);

create index if not exists file_versions_recent_idx
  on public.file_versions (project_id, created_at desc);

-- 4) deployments — every publish (sandbox→production) lands here
create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  branch text not null default 'main',
  source_env public.preview_env not null default 'sandbox',
  target_env public.preview_env not null default 'production',
  status public.deployment_status not null default 'pending',
  label text,
  summary text,
  files_changed int not null default 0,
  diff_stats jsonb not null default '{}'::jsonb,
  triggered_by text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  current boolean not null default false
);

create index if not exists deployments_project_idx
  on public.deployments (project_id, started_at desc);

create unique index if not exists deployments_current_unique
  on public.deployments (project_id, target_env)
  where current = true;

-- 5) rollback_history — audit every restore
create table if not exists public.rollback_history (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  scope public.rollback_scope not null,
  target_id uuid not null,         -- file_versions.id OR deployments.id
  reason text,
  triggered_by text,
  succeeded boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists rollback_history_project_idx
  on public.rollback_history (project_id, created_at desc);

-- 6) Auto-snapshot trigger on project_files (writes go via service_role)
create or replace function public.snapshot_project_file()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  change_kind public.project_file_change;
begin
  if (tg_op = 'INSERT') then change_kind := 'create';
  elsif (tg_op = 'DELETE') then change_kind := 'delete';
  else change_kind := 'update';
  end if;

  insert into public.file_versions (project_id, env, branch, path, content, checksum, change, author)
  values (
    coalesce(new.project_id, old.project_id),
    coalesce(new.env, old.env),
    coalesce(new.branch, old.branch),
    coalesce(new.path, old.path),
    case when tg_op = 'DELETE' then null else new.content end,
    case when tg_op = 'DELETE' then null else new.checksum end,
    change_kind,
    case when tg_op = 'DELETE' then null else new.updated_by end
  );
  return coalesce(new, old);
end $$;

drop trigger if exists project_files_snapshot on public.project_files;
create trigger project_files_snapshot
  after insert or update or delete on public.project_files
  for each row execute function public.snapshot_project_file();

-- 7) updated_at maintenance trigger reuse for deployments
drop trigger if exists deployments_set_updated_at on public.deployments;
-- (deployments has no updated_at column — finished_at is the lifecycle marker)

-- 8) Grants
grant select on public.file_versions to authenticated;
grant all on public.file_versions to service_role;
grant select on public.deployments to authenticated;
grant all on public.deployments to service_role;
grant select on public.rollback_history to authenticated;
grant all on public.rollback_history to service_role;

-- 9) RLS — read for authenticated; writes server-side only
alter table public.file_versions enable row level security;
alter table public.deployments enable row level security;
alter table public.rollback_history enable row level security;

drop policy if exists file_versions_read on public.file_versions;
create policy file_versions_read on public.file_versions
  for select to authenticated using (true);

drop policy if exists deployments_read on public.deployments;
create policy deployments_read on public.deployments
  for select to authenticated using (true);

drop policy if exists rollback_history_read on public.rollback_history;
create policy rollback_history_read on public.rollback_history
  for select to authenticated using (true);

-- 10) Realtime
do $$ begin
  alter publication supabase_realtime add table public.file_versions;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.deployments;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.rollback_history;
exception when duplicate_object then null; end $$;
