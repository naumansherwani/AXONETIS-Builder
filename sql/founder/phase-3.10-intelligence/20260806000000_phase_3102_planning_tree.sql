-- AXONETIS Phase 3.10.2 — Planning Tree (Supabase 3)
-- Idempotent. Run in Supabase 3 SQL editor.

create table if not exists public.agent_plans (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  project_id text,
  message_id uuid,
  goal text not null,
  status text not null default 'planning'
    check (status in ('planning','running','done','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_plan_nodes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.agent_plans(id) on delete cascade,
  node_key text not null,
  parent_key text,
  title text not null,
  kind text not null default 'task' check (kind in ('task','verify','subagent')),
  status text not null default 'pending'
    check (status in ('pending','running','done','failed','skipped')),
  detail text,
  agent text,
  tool text,
  cost_usd numeric(12,6),
  duration_ms integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, node_key)
);

create index if not exists agent_plans_thread_idx on public.agent_plans (thread_id, created_at desc);
create index if not exists agent_plan_nodes_plan_idx on public.agent_plan_nodes (plan_id, sort_order);

grant select on public.agent_plans to anon, authenticated;
grant select on public.agent_plan_nodes to anon, authenticated;
grant all on public.agent_plans to service_role;
grant all on public.agent_plan_nodes to service_role;

alter table public.agent_plans enable row level security;
alter table public.agent_plan_nodes enable row level security;

drop policy if exists "plans readable" on public.agent_plans;
create policy "plans readable" on public.agent_plans for select using (true);
drop policy if exists "plan nodes readable" on public.agent_plan_nodes;
create policy "plan nodes readable" on public.agent_plan_nodes for select using (true);
