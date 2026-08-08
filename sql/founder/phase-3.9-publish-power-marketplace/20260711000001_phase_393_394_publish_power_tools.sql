-- =====================================================================
-- AXONETIS™ Builder — Phase 3.9.3 + 3.9.4 server tables
-- Target: self-hosted DB on Hetzner. Safe/idempotent.
-- IMPORTANT: CREATE TABLE → GRANT → ENABLE RLS → POLICY.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Publish settings: visibility, custom domain, unpublish state.
create table if not exists public.publish_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('public','unlisted','private')),
  custom_domain text,
  unpublished_at timestamptz,
  last_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);
grant select, insert, update, delete on public.publish_settings to authenticated;
grant all on public.publish_settings to service_role;
alter table public.publish_settings enable row level security;
drop policy if exists "publish_settings: admin full" on public.publish_settings;
create policy "publish_settings: admin full" on public.publish_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Share links: store only token hash; raw token appears once in response URL.
create table if not exists public.publish_share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_publish_share_links_project on public.publish_share_links(project_id, expires_at desc);
grant select, insert, update, delete on public.publish_share_links to authenticated;
grant all on public.publish_share_links to service_role;
alter table public.publish_share_links enable row level security;
drop policy if exists "publish_share_links: admin full" on public.publish_share_links;
create policy "publish_share_links: admin full" on public.publish_share_links
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Visitor events: optional realtime visitor badge source.
create table if not exists public.visitor_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text,
  referrer text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_visitor_events_project_time on public.visitor_events(project_id, created_at desc);
grant select, insert, delete on public.visitor_events to authenticated;
grant all on public.visitor_events to service_role;
alter table public.visitor_events enable row level security;
drop policy if exists "visitor_events: admin full" on public.visitor_events;
create policy "visitor_events: admin full" on public.visitor_events
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Custom domains managed by Caddy endpoint.
create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  domain text not null,
  target text not null,
  ssl text not null default 'pending' check (ssl in ('pending','issuing','active','failed')),
  attached_at timestamptz not null default now(),
  last_check timestamptz,
  unique (project_id, domain)
);
create index if not exists idx_custom_domains_project on public.custom_domains(project_id);
grant select, insert, update, delete on public.custom_domains to authenticated;
grant all on public.custom_domains to service_role;
alter table public.custom_domains enable row level security;
drop policy if exists "custom_domains: admin full" on public.custom_domains;
create policy "custom_domains: admin full" on public.custom_domains
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- rrweb sessions + events.
create table if not exists public.rrweb_sessions (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_event_at timestamptz,
  event_count integer not null default 0
);
create index if not exists idx_rrweb_sessions_project on public.rrweb_sessions(project_id, started_at desc);
grant select, insert, update, delete on public.rrweb_sessions to authenticated;
grant all on public.rrweb_sessions to service_role;
alter table public.rrweb_sessions enable row level security;
drop policy if exists "rrweb_sessions: admin full" on public.rrweb_sessions;
create policy "rrweb_sessions: admin full" on public.rrweb_sessions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.rrweb_events (
  id bigserial primary key,
  session_id text not null references public.rrweb_sessions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_rrweb_events_session on public.rrweb_events(session_id, id);
create index if not exists idx_rrweb_events_project on public.rrweb_events(project_id, created_at desc);
grant select, insert, delete on public.rrweb_events to authenticated;
grant all on public.rrweb_events to service_role;
alter table public.rrweb_events enable row level security;
drop policy if exists "rrweb_events: admin full" on public.rrweb_events;
create policy "rrweb_events: admin full" on public.rrweb_events
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Maintain rrweb session counters automatically.
create or replace function public.bump_rrweb_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rrweb_sessions
    set event_count = event_count + 1,
        last_event_at = now()
    where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists rrweb_events_bump_session on public.rrweb_events;
create trigger rrweb_events_bump_session
  after insert on public.rrweb_events
  for each row execute function public.bump_rrweb_session();

grant execute on function public.bump_rrweb_session() to authenticated, service_role;
