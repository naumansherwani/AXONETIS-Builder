-- AXONETIS Phase 3.10.2 sub-step 3 — Sub-Agent Delegation (Supabase 3)
-- Idempotent. Run in Supabase 3 SQL editor.

create table if not exists public.agent_delegations (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  project_id text,
  message_id uuid,
  goal text,
  parent_agent text not null default 'jimmy',
  status text not null default 'running'
    check (status in ('running','done','failed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_delegation_tasks (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.agent_delegations(id) on delete cascade,
  agent text not null default 'advisor',
  title text not null,
  status text not null default 'queued'
    check (status in ('queued','running','done','failed','cancelled')),
  model text,
  summary text,
  tokens integer,
  duration_ms integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_delegations_thread_idx
  on public.agent_delegations (thread_id, created_at desc);
create index if not exists agent_delegation_tasks_run_idx
  on public.agent_delegation_tasks (delegation_id, sort_order);

grant select on public.agent_delegations to anon, authenticated;
grant select on public.agent_delegation_tasks to anon, authenticated;
grant all on public.agent_delegations to service_role;
grant all on public.agent_delegation_tasks to service_role;

alter table public.agent_delegations enable row level security;
alter table public.agent_delegation_tasks enable row level security;

drop policy if exists "delegations readable" on public.agent_delegations;
create policy "delegations readable" on public.agent_delegations for select using (true);
drop policy if exists "delegation tasks readable" on public.agent_delegation_tasks;
create policy "delegation tasks readable" on public.agent_delegation_tasks for select using (true);
