-- AXONETIS Phase 11.2 (Daily Standup) + 11.3 (Compliance Badge) — idempotent
-- Supabase 3 (self-hosted). Jimmy writes standups, Sherlock writes compliance.

-- ── 11.2 campaigns ─────────────────────────────────────────────────────────
create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Outreach',
  status text not null default 'running',
  provider text,
  daily_quota integer not null default 200,
  sent_today integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.outreach_campaigns add column if not exists status text not null default 'running';
alter table public.outreach_campaigns add column if not exists provider text;
alter table public.outreach_campaigns add column if not exists daily_quota integer not null default 200;
alter table public.outreach_campaigns add column if not exists sent_today integer not null default 0;
alter table public.outreach_campaigns add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.outreach_campaigns add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_campaigns_status_chk') then
    alter table public.outreach_campaigns add constraint outreach_campaigns_status_chk
      check (status in ('running','paused')) not valid;
  end if;
end $$;

-- ── 11.2 standups ──────────────────────────────────────────────────────────
create table if not exists public.outreach_standups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  agent_slug text not null default 'jimmy',
  message text not null default '',
  stats jsonb,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.outreach_standups add column if not exists campaign_id uuid;
alter table public.outreach_standups add column if not exists agent_slug text not null default 'jimmy';
alter table public.outreach_standups add column if not exists message text not null default '';
alter table public.outreach_standups add column if not exists stats jsonb;
alter table public.outreach_standups add column if not exists issues jsonb not null default '[]'::jsonb;
alter table public.outreach_standups add column if not exists created_at timestamptz not null default now();
create index if not exists outreach_standups_created_idx on public.outreach_standups (created_at desc);

-- ── 11.3 compliance ────────────────────────────────────────────────────────
create table if not exists public.outreach_compliance (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  gdpr_ok boolean not null default false,
  gdpr_note text,
  spam_score numeric(4,2),
  unsubscribe_ok boolean not null default false,
  sherlock_approved boolean not null default false,
  sherlock_note text,
  sherlock_approved_at timestamptz,
  checked_at timestamptz not null default now()
);
alter table public.outreach_compliance add column if not exists campaign_id uuid;
alter table public.outreach_compliance add column if not exists gdpr_ok boolean not null default false;
alter table public.outreach_compliance add column if not exists gdpr_note text;
alter table public.outreach_compliance add column if not exists spam_score numeric(4,2);
alter table public.outreach_compliance add column if not exists unsubscribe_ok boolean not null default false;
alter table public.outreach_compliance add column if not exists sherlock_approved boolean not null default false;
alter table public.outreach_compliance add column if not exists sherlock_note text;
alter table public.outreach_compliance add column if not exists sherlock_approved_at timestamptz;
alter table public.outreach_compliance add column if not exists checked_at timestamptz not null default now();
create index if not exists outreach_compliance_checked_idx on public.outreach_compliance (checked_at desc);

-- ── grants + RLS (founder-only app, authenticated read/write) ───────────────
do $$
declare t text;
begin
  foreach t in array array['outreach_campaigns','outreach_standups','outreach_compliance'] loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s founder read" on public.%I', t, t);
    execute format('create policy "%s founder read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s founder write" on public.%I', t, t);
    execute format('create policy "%s founder write" on public.%I for all to authenticated using (true) with check (true)', t, t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
