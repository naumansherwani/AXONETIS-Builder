-- ============================================================
-- ⚠️ SUPABASE 3 SQL — Phase 6 (Version Control & Recovery)
-- SELF-CONTAINED: creates its own enums if missing.
-- Idempotent: safe to re-run any number of times.
--
-- Tables:
--   file_versions     — append-only snapshot of every project_files write
--   deployments       — sandbox→production publish history
--   rollback_history  — audit log of every restore action
-- ============================================================

-- ─────────────────────────────────────────────
-- 0) ENUMS (create if missing — no dependency on Phase 5)
-- ─────────────────────────────────────────────

do $$ begin
  create type public.preview_env as enum ('sandbox', 'production');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_file_change as enum ('create', 'update', 'delete');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.deployment_status as enum ('pending', 'building', 'live', 'failed', 'rolled_back');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.rollback_scope as enum ('file', 'deployment', 'project');
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────
-- 1) file_versions
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 2) deployments
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 3) rollback_history
-- ─────────────────────────────────────────────
create table if not exists public.rollback_history (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  scope public.rollback_scope not null,
  target_id uuid not null,
  reason text,
  triggered_by text,
  succeeded boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists rollback_history_project_idx
  on public.rollback_history (project_id, created_at desc);

-- ─────────────────────────────────────────────
-- 4) Auto-snapshot trigger on project_files (only if table exists)
--    Uses dynamic column lookup so it works even if project_files lacks env/branch/updated_by.
-- ─────────────────────────────────────────────
do $phase6_snapshot$
declare
  has_env boolean;
  has_branch boolean;
  has_updated_by boolean;
  has_checksum boolean;
begin
  if not exists (select 1 from pg_class where relname = 'project_files' and relnamespace = 'public'::regnamespace) then
    raise notice 'project_files table not found — skipping snapshot trigger. Run Phase 5 first, then re-run this migration.';
    return;
  end if;

  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='project_files' and column_name='env') into has_env;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='project_files' and column_name='branch') into has_branch;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='project_files' and column_name='updated_by') into has_updated_by;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='project_files' and column_name='checksum') into has_checksum;

  execute format($f$
    create or replace function public.snapshot_project_file()
    returns trigger language plpgsql security definer set search_path = public as $body$
    declare
      change_kind public.project_file_change;
    begin
      if (tg_op = 'INSERT') then change_kind := 'create';
      elsif (tg_op = 'DELETE') then change_kind := 'delete';
      else change_kind := 'update';
      end if;

      if (tg_op = 'DELETE') then
        insert into public.file_versions (project_id, env, branch, path, content, checksum, change, author)
        values (old.project_id::text, %s, %s, old.path::text, null, null, change_kind, null);
        return old;
      end if;

      insert into public.file_versions (project_id, env, branch, path, content, checksum, change, author)
      values (new.project_id::text, %s, %s, new.path::text, new.content::text, %s, change_kind, %s);
      return new;
    end $body$;
  $f$,
    case when has_env        then 'old.env::public.preview_env' else '''sandbox''::public.preview_env' end,
    case when has_branch     then 'old.branch::text' else '''main''' end,
    case when has_env        then 'new.env::public.preview_env' else '''sandbox''::public.preview_env' end,
    case when has_branch     then 'new.branch::text' else '''main''' end,
    case when has_checksum   then 'new.checksum::text' else 'null' end,
    case when has_updated_by then 'new.updated_by::text' else 'null' end
  );

  drop trigger if exists project_files_snapshot on public.project_files;
  create trigger project_files_snapshot
    after insert or update or delete on public.project_files
    for each row execute function public.snapshot_project_file();
end $phase6_snapshot$;

-- ─────────────────────────────────────────────
-- 5) Grants (Data API access)
-- ─────────────────────────────────────────────
grant select on public.file_versions to authenticated;
grant all    on public.file_versions to service_role;
grant select on public.deployments   to authenticated;
grant all    on public.deployments   to service_role;
grant select on public.rollback_history to authenticated;
grant all    on public.rollback_history to service_role;

-- ─────────────────────────────────────────────
-- 6) RLS
-- ─────────────────────────────────────────────
alter table public.file_versions    enable row level security;
alter table public.deployments      enable row level security;
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

-- ─────────────────────────────────────────────
-- 7) Realtime
-- ─────────────────────────────────────────────
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.file_versions;
  end if;
exception when duplicate_object then null; end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.deployments;
  end if;
exception when duplicate_object then null; end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rollback_history;
  end if;
exception when duplicate_object then null; end $$;
