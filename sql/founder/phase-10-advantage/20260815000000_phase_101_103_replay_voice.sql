-- ============================================================================
-- Phase 10.1 · 10.2 · 10.3 — Advantage Layer: Session Replay, Sherlock Replay
-- Analyzer, Voice Composer transcripts.   Target: Supabase 3 (founder).
-- Idempotent — safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── 10.1 replay_sessions ────────────────────────────────────────────────────
create table if not exists public.replay_sessions (
  id           uuid primary key default gen_random_uuid(),
  project_id   text        not null,
  session_id   text        not null,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  duration_ms  integer     not null default 0,
  event_count  integer     not null default 0,
  user_agent   text,
  created_at   timestamptz not null default now()
);
alter table public.replay_sessions add column if not exists duration_ms integer not null default 0;
alter table public.replay_sessions add column if not exists event_count integer not null default 0;
alter table public.replay_sessions add column if not exists user_agent text;
create unique index if not exists replay_sessions_project_session_key
  on public.replay_sessions (project_id, session_id);
create index if not exists replay_sessions_started_idx
  on public.replay_sessions (project_id, started_at desc);

grant select, insert, update, delete on public.replay_sessions to authenticated;
grant all on public.replay_sessions to service_role;
alter table public.replay_sessions enable row level security;
do $$ begin
  create policy "replay_sessions auth all" on public.replay_sessions
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ── 10.1 replay_events (rrweb batches) ──────────────────────────────────────
create table if not exists public.replay_events (
  id          bigserial primary key,
  project_id  text        not null,
  session_id  text        not null,
  seq         integer     not null default 0,
  events      jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists replay_events_session_idx
  on public.replay_events (project_id, session_id, seq);

grant select, insert, delete on public.replay_events to authenticated;
grant all on public.replay_events to service_role;
alter table public.replay_events enable row level security;
do $$ begin
  create policy "replay_events auth all" on public.replay_events
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ── 10.2 replay_analyses (Sherlock) ─────────────────────────────────────────
create table if not exists public.replay_analyses (
  id           uuid primary key default gen_random_uuid(),
  project_id   text        not null,
  session_id   text        not null,
  root_cause   text        not null default '',
  summary      text        not null default '',
  fix_path     text,
  fix_language text,
  fix_snippet  text,
  confidence   integer     not null default 0,
  diff_id      uuid,
  created_at   timestamptz not null default now()
);
alter table public.replay_analyses add column if not exists diff_id uuid;
do $$ begin
  alter table public.replay_analyses
    add constraint replay_analyses_confidence_range check (confidence between 0 and 100)
    not valid;
exception when duplicate_object then null; end $$;

create index if not exists replay_analyses_session_idx
  on public.replay_analyses (project_id, session_id, created_at desc);

grant select, insert, update on public.replay_analyses to authenticated;
grant all on public.replay_analyses to service_role;
alter table public.replay_analyses enable row level security;
do $$ begin
  create policy "replay_analyses auth all" on public.replay_analyses
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ── 10.3 voice_transcripts ──────────────────────────────────────────────────
create table if not exists public.voice_transcripts (
  id          uuid primary key default gen_random_uuid(),
  project_id  text        not null,
  transcript  text        not null default '',
  language    text,                    -- auto-detected: ur | en | hi
  duration_ms integer     not null default 0,
  intent      text,                    -- detected slash command, if any
  cancelled   boolean     not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists voice_transcripts_project_idx
  on public.voice_transcripts (project_id, created_at desc);

grant select, insert on public.voice_transcripts to authenticated;
grant all on public.voice_transcripts to service_role;
alter table public.voice_transcripts enable row level security;
do $$ begin
  create policy "voice_transcripts auth all" on public.voice_transcripts
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
