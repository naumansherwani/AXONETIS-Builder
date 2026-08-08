-- AXONETIS Phase 11.1 — OUTREACH ENGINE (outreach_leads) — idempotent
create table if not exists public.outreach_leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text,
  email text,
  website text,
  industry text,
  country text,
  stage text not null default 'scraped',
  mrr_value numeric(12,2) not null default 0,
  score integer,
  owner_agent text,
  source text,
  last_touch_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.outreach_leads add column if not exists contact_name text;
alter table public.outreach_leads add column if not exists email text;
alter table public.outreach_leads add column if not exists website text;
alter table public.outreach_leads add column if not exists industry text;
alter table public.outreach_leads add column if not exists country text;
alter table public.outreach_leads add column if not exists stage text not null default 'scraped';
alter table public.outreach_leads add column if not exists mrr_value numeric(12,2) not null default 0;
alter table public.outreach_leads add column if not exists score integer;
alter table public.outreach_leads add column if not exists owner_agent text;
alter table public.outreach_leads add column if not exists source text;
alter table public.outreach_leads add column if not exists last_touch_at timestamptz;
alter table public.outreach_leads add column if not exists notes text;
alter table public.outreach_leads add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.outreach_leads add column if not exists created_at timestamptz not null default now();
alter table public.outreach_leads add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_leads_stage_chk') then
    alter table public.outreach_leads add constraint outreach_leads_stage_chk
      check (stage in ('scraped','qualified','contacted','replied','demo','closed')) not valid;
  end if;
end $$;

create unique index if not exists outreach_leads_email_idx on public.outreach_leads (lower(email)) where email is not null;
create index if not exists outreach_leads_stage_idx on public.outreach_leads (stage, created_at desc);

create or replace function public.touch_outreach_leads()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_outreach_leads_touch on public.outreach_leads;
create trigger trg_outreach_leads_touch before update on public.outreach_leads
  for each row execute function public.touch_outreach_leads();

grant select, insert, update on public.outreach_leads to authenticated;
grant all on public.outreach_leads to service_role;
alter table public.outreach_leads enable row level security;
drop policy if exists "outreach_leads founder read" on public.outreach_leads;
create policy "outreach_leads founder read" on public.outreach_leads for select to authenticated using (true);
drop policy if exists "outreach_leads founder write" on public.outreach_leads;
create policy "outreach_leads founder write" on public.outreach_leads for update to authenticated using (true) with check (true);
drop policy if exists "outreach_leads founder insert" on public.outreach_leads;
create policy "outreach_leads founder insert" on public.outreach_leads for insert to authenticated with check (true);

create or replace view public.outreach_pipeline_summary as
  select stage, count(*) as leads, coalesce(sum(mrr_value),0) as mrr,
         coalesce(sum(mrr_value),0) * 12 as arr
  from public.outreach_leads group by stage;
grant select on public.outreach_pipeline_summary to authenticated, service_role;

do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='outreach_leads') then
    alter publication supabase_realtime add table public.outreach_leads;
  end if;
end $$;

notify pgrst, 'reload schema';
