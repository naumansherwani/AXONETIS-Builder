-- AXONETIS Phase 3.10.8 — LSP inline diagnostics (Supabase 3)
-- Idempotent. Run in Supabase 3 SQL editor.

create table if not exists public.project_diagnostics (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  path text not null,
  line integer not null default 1,
  "column" integer not null default 1,
  severity text not null default 'error'
    check (severity in ('error','warning')),
  code text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_diagnostics_project_idx
  on public.project_diagnostics (project_id, path, line);
create index if not exists project_diagnostics_created_idx
  on public.project_diagnostics (project_id, created_at desc);

grant select on public.project_diagnostics to authenticated;
grant select on public.project_diagnostics to anon;
grant all on public.project_diagnostics to service_role;

alter table public.project_diagnostics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_diagnostics'
      and policyname = 'diagnostics readable'
  ) then
    create policy "diagnostics readable" on public.project_diagnostics
      for select using (true);
  end if;
end $$;

-- Realtime for the Problems badge + squiggles
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_diagnostics'
  ) then
    alter publication supabase_realtime add table public.project_diagnostics;
  end if;
end $$;
