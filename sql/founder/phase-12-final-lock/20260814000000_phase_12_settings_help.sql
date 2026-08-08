-- ============================================================================
-- PHASE 12 — FINAL LOCK  (12.1 Settings Panel · 12.3 Help Center)
-- Target: SUPABASE 3 (self-hosted, AXONETIS Builder only)
-- Idempotent: safe to run multiple times.
-- 12.2 Onboarding Flow is intentionally NOT here — it is part of the public
-- ("awam") wrapper, per founder lock.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FOUNDER_SETTINGS — single row (key = 'founder')
-- ----------------------------------------------------------------------------
create table if not exists public.founder_settings (
  key                text primary key,
  memory_limit_mb    integer      not null default 512,
  cost_daily_usd     numeric(12,2) not null default 25,
  cost_weekly_usd    numeric(12,2) not null default 120,
  cost_monthly_usd   numeric(12,2) not null default 400,
  notify_mode        text         not null default 'in-app',
  theme              text         not null default 'dark',
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);

alter table public.founder_settings add column if not exists memory_limit_mb  integer;
alter table public.founder_settings add column if not exists cost_daily_usd   numeric(12,2);
alter table public.founder_settings add column if not exists cost_weekly_usd  numeric(12,2);
alter table public.founder_settings add column if not exists cost_monthly_usd numeric(12,2);
alter table public.founder_settings add column if not exists notify_mode      text;
alter table public.founder_settings add column if not exists theme            text;
alter table public.founder_settings add column if not exists updated_at       timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'founder_settings_notify_mode_chk'
  ) then
    alter table public.founder_settings
      add constraint founder_settings_notify_mode_chk
      check (notify_mode in ('email','in-app','none'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'founder_settings_theme_chk'
  ) then
    alter table public.founder_settings
      add constraint founder_settings_theme_chk
      check (theme in ('dark','light','system'));
  end if;
end $$;

grant select, insert, update on public.founder_settings to authenticated;
grant all on public.founder_settings to service_role;
alter table public.founder_settings enable row level security;

drop policy if exists "founder_settings: read auth"  on public.founder_settings;
drop policy if exists "founder_settings: write auth" on public.founder_settings;
create policy "founder_settings: read auth"  on public.founder_settings
  for select to authenticated using (true);
create policy "founder_settings: write auth" on public.founder_settings
  for all to authenticated using (true) with check (true);

insert into public.founder_settings (key) values ('founder')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2. HELP_ARTICLES — Help Center content (12.3)
-- ----------------------------------------------------------------------------
create table if not exists public.help_articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  category     text not null default 'Getting Started',
  summary      text,
  body_md      text not null default '',
  video_url    text,
  sort_order   integer not null default 100,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.help_articles add column if not exists summary      text;
alter table public.help_articles add column if not exists video_url    text;
alter table public.help_articles add column if not exists sort_order   integer default 100;
alter table public.help_articles add column if not exists is_published boolean default true;
alter table public.help_articles add column if not exists updated_at   timestamptz default now();

create index if not exists idx_help_articles_category
  on public.help_articles(category, sort_order);
create index if not exists idx_help_articles_published
  on public.help_articles(is_published);

grant select on public.help_articles to authenticated;
grant all    on public.help_articles to service_role;
alter table public.help_articles enable row level security;

drop policy if exists "help_articles: read auth"     on public.help_articles;
drop policy if exists "help_articles: service write" on public.help_articles;
create policy "help_articles: read auth" on public.help_articles
  for select to authenticated using (is_published);

-- ----------------------------------------------------------------------------
-- 3. updated_at triggers (reuse existing touch_updated_at if present)
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_founder_settings_touch on public.founder_settings;
create trigger trg_founder_settings_touch before update on public.founder_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_help_articles_touch on public.help_articles;
create trigger trg_help_articles_touch before update on public.help_articles
  for each row execute function public.touch_updated_at();
