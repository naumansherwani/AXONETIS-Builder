-- ============================================================================
-- AXONETIS AI Builder™ — Phase 4: Jimmy + Sherlock Dual-Brain Workflow
-- Target: self-hosted Supabase 3 on Hetzner.
-- Safe to re-run: tables/indexes/grants are idempotent; policies are dropped
-- and recreated so duplicate policy errors cannot break the SQL editor.
-- ============================================================================

do $$ begin
  create type public.dual_brain_stage as enum (
    'queued',
    'jimmy_planning',
    'jimmy_coding',
    'sherlock_reviewing',
    'awaiting_approval',
    'approved',
    'rejected',
    'applied',
    'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dual_brain_actor as enum ('jimmy', 'sherlock');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dual_brain_phase as enum ('plan', 'code', 'review', 'verdict', 'fix', 'apply');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dual_brain_verdict as enum ('approve', 'reject', 'needs_changes');
exception when duplicate_object then null; end $$;

create table if not exists public.dual_brain_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  project_id text not null,
  thread_id uuid,
  prompt text not null,
  stage public.dual_brain_stage not null default 'queued',
  plan_summary text,
  code_diff text,
  sherlock_verdict public.dual_brain_verdict,
  sherlock_notes text,
  iteration int not null default 1,
  max_iterations int not null default 3 check (max_iterations between 1 and 3),
  total_cost_usd numeric(12,6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.dual_brain_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.dual_brain_runs(id) on delete cascade,
  actor public.dual_brain_actor not null,
  phase public.dual_brain_phase not null,
  title text not null,
  body text not null default '',
  model text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  duration_ms int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_dual_brain_runs_project on public.dual_brain_runs(project_id, started_at desc);
create index if not exists idx_dual_brain_runs_stage on public.dual_brain_runs(stage, started_at desc);
create index if not exists idx_dual_brain_steps_run on public.dual_brain_steps(run_id, created_at);

grant select, insert, update, delete on public.dual_brain_runs to authenticated;
grant select, insert, update, delete on public.dual_brain_steps to authenticated;
grant all on public.dual_brain_runs to service_role;
grant all on public.dual_brain_steps to service_role;

alter table public.dual_brain_runs enable row level security;
alter table public.dual_brain_steps enable row level security;

drop policy if exists dbr_owner_all on public.dual_brain_runs;
drop policy if exists dbs_owner_read on public.dual_brain_steps;
drop policy if exists dbs_owner_all on public.dual_brain_steps;

create policy dbr_owner_all on public.dual_brain_runs
  for all to authenticated
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid() or user_id is null);

create policy dbs_owner_read on public.dual_brain_steps
  for select to authenticated
  using (
    exists (
      select 1
      from public.dual_brain_runs r
      where r.id = run_id
        and (r.user_id = auth.uid() or r.user_id is null)
    )
  );

create policy dbs_owner_all on public.dual_brain_steps
  for all to authenticated
  using (
    exists (
      select 1
      from public.dual_brain_runs r
      where r.id = run_id
        and (r.user_id = auth.uid() or r.user_id is null)
    )
  )
  with check (
    exists (
      select 1
      from public.dual_brain_runs r
      where r.id = run_id
        and (r.user_id = auth.uid() or r.user_id is null)
    )
  );

-- Realtime/SSE support for inserted steps and stage updates.
do $$ begin
  alter publication supabase_realtime add table public.dual_brain_runs;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.dual_brain_steps;
exception when duplicate_object then null; end $$;