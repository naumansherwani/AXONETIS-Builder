-- ============================================================
-- Phase 3.10.3-B — agent_diffs (Supabase 3, self-hosted)
-- Idempotent. Run in Supabase 3 SQL editor / psql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_diffs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid,
  message_id    uuid,
  project_slug  text,
  path          text NOT NULL,
  old_content   text,
  new_content   text,
  language      text,
  sherlock      text CHECK (sherlock IN ('pass','fail','retry')),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','applied','error')),
  error         text,
  decided_at    timestamptz,
  applied_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_diffs ADD COLUMN IF NOT EXISTS sherlock text;
ALTER TABLE public.agent_diffs ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE public.agent_diffs ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE public.agent_diffs ADD COLUMN IF NOT EXISTS error text;

CREATE INDEX IF NOT EXISTS agent_diffs_thread_idx ON public.agent_diffs (thread_id, created_at);
CREATE INDEX IF NOT EXISTS agent_diffs_status_idx ON public.agent_diffs (status);

GRANT SELECT ON public.agent_diffs TO authenticated;
GRANT ALL ON public.agent_diffs TO service_role;

ALTER TABLE public.agent_diffs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_diffs'
      AND policyname = 'agent_diffs_read_authenticated'
  ) THEN
    CREATE POLICY agent_diffs_read_authenticated ON public.agent_diffs
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
