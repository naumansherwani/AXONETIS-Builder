-- AXONETIS Phase 3.10.2 sub-step 2 — Self-Verification Loop (Supabase 3)
-- Idempotent. Run in Supabase 3 SQL editor.

create table if not exists public.agent_verifications (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  project_id text,
  message_id uuid,
  target text,
  agent text default 'sherlock',
  attempt integer not null default 1,
  max_attempts integer not null default 3,
  status text not null default 'running'
    check (status in ('running','pass','fail','retrying')),
  verdict text,
  fix_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_verification_checks (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.agent_verifications(id) on delete cascade,
  check_key text not null,
  label text not null,
  kind text not null default 'logic'
    check (kind in ('logic','security','performance','build','test')),
  status text not null default 'pending'
    check (status in ('pending','running','pass','fail','skipped')),
  detail text,
  duration_ms integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (verification_id, check_key)
);

create index if not exists agent_verifications_thread_idx
  on public.agent_verifications (thread_id, created_at desc);
create index if not exists agent_verification_checks_run_idx
  on public.agent_verification_checks (verification_id, sort_order);

grant select on public.agent_verifications to anon, authenticated;
grant select on public.agent_verification_checks to anon, authenticated;
grant all on public.agent_verifications to service_role;
grant all on public.agent_verification_checks to service_role;

alter table public.agent_verifications enable row level security;
alter table public.agent_verification_checks enable row level security;

drop policy if exists "verifications readable" on public.agent_verifications;
create policy "verifications readable" on public.agent_verifications for select using (true);
drop policy if exists "verification checks readable" on public.agent_verification_checks;
create policy "verification checks readable" on public.agent_verification_checks for select using (true);
