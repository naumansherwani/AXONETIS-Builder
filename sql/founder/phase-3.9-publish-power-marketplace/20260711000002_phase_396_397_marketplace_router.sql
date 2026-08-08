-- Phase 3.9.6 + 3.9.7 — Agent Marketplace + Global Router audit log.
-- Runs on Supabase 3 (`axonetis-builder`), founder-only.
--
-- Tables:
--   marketplace_agents        — catalog (curated + community)
--   marketplace_installs      — per-project installs
--   router_decisions          — every prompt's model pick + savings vs default
--
-- Grants + RLS follow the project's public_schema_grants rule.

begin;

-- ─────────────────────────────────────────────────────────────
-- 0. Ensure founder product rows exist for smoke tests + agent loop writes.
-- ─────────────────────────────────────────────────────────────
insert into public.projects (slug, name, short_name, preview_url, accent, description)
values
  ('hostflowai',      'HostFlow AI™',          'HostFlow',  'https://hostflowai.net',          '#E50914', 'NEXATECT HostFlow product workspace'),
  ('rapidpay',        'ANEXVOT AI PAY™',       'ANEXVOT',   'https://anexvotaipay.com',        '#7c3aed', 'NEXATECT ANEXVOT AI Pay product workspace'),
  ('anexvotaipay',    'ANEXVOT AI PAY™',       'ANEXVOT',   'https://anexvotaipay.com',        '#7c3aed', 'NEXATECT ANEXVOT AI Pay alias workspace'),
  ('founderbuilder',  'AXONETIS AI Builder™',  'AXONETIS',  'https://founderbuilder.axonetis.com', '#1a0933', 'AXONETIS builder workspace')
on conflict (slug) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  preview_url = excluded.preview_url,
  accent = excluded.accent,
  description = excluded.description,
  updated_at = now();

-- ─────────────────────────────────────────────────────────────
-- 1. Marketplace catalog
-- ─────────────────────────────────────────────────────────────
create table if not exists public.marketplace_agents (
  slug          text primary key,
  name          text not null,
  tagline       text not null default '',
  description   text not null default '',
  category      text not null check (category in ('build','review','ops','data','creative','outreach')),
  author        text not null default 'NEXATECT',
  version       text not null default '0.1.0',
  icon          text,
  price_usd     numeric(10,2) not null default 0,
  installs      integer not null default 0,
  rating        numeric(3,2) not null default 0,
  tools         jsonb not null default '[]'::jsonb,
  featured      boolean not null default false,
  official      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

grant select on public.marketplace_agents to authenticated;
grant all    on public.marketplace_agents to service_role;

alter table public.marketplace_agents enable row level security;
drop policy if exists "marketplace_agents readable by founder" on public.marketplace_agents;
create policy "marketplace_agents readable by founder"
  on public.marketplace_agents for select
  to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────
-- 2. Per-project installs
-- ─────────────────────────────────────────────────────────────
create table if not exists public.marketplace_installs (
  id            uuid primary key default gen_random_uuid(),
  project_id    text not null,
  agent_slug    text not null references public.marketplace_agents(slug) on delete cascade,
  version       text not null,
  enabled       boolean not null default true,
  installed_by  uuid,
  installed_at  timestamptz not null default now(),
  unique (project_id, agent_slug)
);

create index if not exists idx_marketplace_installs_project on public.marketplace_installs(project_id);

grant select, insert, update, delete on public.marketplace_installs to authenticated;
grant all on public.marketplace_installs to service_role;

alter table public.marketplace_installs enable row level security;
drop policy if exists "installs readable" on public.marketplace_installs;
create policy "installs readable"
  on public.marketplace_installs for select to authenticated using (true);
drop policy if exists "installs writable" on public.marketplace_installs;
create policy "installs writable"
  on public.marketplace_installs for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- 3. Global Router decision log (cost meter truth source)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.router_decisions (
  id                uuid primary key default gen_random_uuid(),
  thread_id         uuid,
  message_id        uuid,
  project_id        text,
  agent_slug        text not null,
  chosen_model      text not null,
  default_model     text not null,
  tier              text,                     -- 'classify' | 'build' | 'audit' | 'reason'
  input_tokens      integer not null default 0,
  output_tokens     integer not null default 0,
  chosen_cost_usd   numeric(12,6) not null default 0,
  default_cost_usd  numeric(12,6) not null default 0,
  saved_usd         numeric(12,6) generated always as (default_cost_usd - chosen_cost_usd) stored,
  reason            text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_router_decisions_thread on public.router_decisions(thread_id, created_at desc);
create index if not exists idx_router_decisions_project on public.router_decisions(project_id, created_at desc);

grant select, insert on public.router_decisions to authenticated;
grant all on public.router_decisions to service_role;

alter table public.router_decisions enable row level security;
drop policy if exists "router_decisions readable" on public.router_decisions;
create policy "router_decisions readable"
  on public.router_decisions for select to authenticated using (true);
drop policy if exists "router_decisions insertable by service" on public.router_decisions;
create policy "router_decisions insertable by service"
  on public.router_decisions for insert to authenticated with check (true);

-- ─────────────────────────────────────────────────────────────
-- 4. Extend agent_thread_messages with cost fields (3.9.7 cost meter)
--    Non-destructive: add-if-missing pattern.
-- ─────────────────────────────────────────────────────────────
alter table public.agent_thread_messages
  add column if not exists cost_usd            numeric(12,6),
  add column if not exists saved_vs_default_usd numeric(12,6),
  add column if not exists default_model       text,
  add column if not exists parent_message_id   uuid,
  add column if not exists loop_iteration      integer,
  add column if not exists audit_status        text;

create index if not exists idx_agent_thread_messages_parent on public.agent_thread_messages(parent_message_id);

-- ─────────────────────────────────────────────────────────────
-- 5. Seed a few first-party agents so the grid isn't empty on Day 1.
-- ─────────────────────────────────────────────────────────────
insert into public.marketplace_agents (slug, name, tagline, description, category, author, version, icon, tools, featured, official)
values
  ('seo-scout',     'SEO Scout',     'Audits pages, ranks keywords, patches meta.',      'Full on-page SEO audit with automatic meta patching.',      'review',  'NEXATECT', '1.0.0', '🔎', '["fetch_url","run_lighthouse","write_file"]'::jsonb, true, true),
  ('outreach-hawk', 'Outreach Hawk', 'Cold-email drafter with Trojan CRM hooks.',        'Drafts personalized cold emails and syncs replies to CRM.', 'outreach','NEXATECT', '0.9.0', '🦅', '["send_email","query_crm"]'::jsonb,                 true, true),
  ('data-bee',      'Data Bee',      'Schema drift detector + migration proposer.',      'Detects schema drift and proposes safe migrations.',        'data',    'NEXATECT', '0.7.0', '🐝', '["run_sql","diff_schema"]'::jsonb,                  false,true),
  ('brand-lens',    'Brand Lens',    'Generates cinematic cover images from prompt.',    'Generates cinematic cover images tuned to brand tokens.',   'creative','NEXATECT', '0.5.0', '🎬', '["generate_image"]'::jsonb,                          false,true),
  ('rollback-medic','Rollback Medic','Auto-restores last green build on error spike.',   'Auto-rolls back deploys when error rates spike.',           'ops',     'NEXATECT', '0.8.0', '🩺', '["git_checkout","deploy"]'::jsonb,                  false,true)
on conflict (slug) do nothing;

create or replace function public.increment_marketplace_installs(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.marketplace_agents
     set installs = installs + 1,
         updated_at = now()
   where slug = p_slug;
$$;

grant execute on function public.increment_marketplace_installs(text) to authenticated, service_role;

commit;
