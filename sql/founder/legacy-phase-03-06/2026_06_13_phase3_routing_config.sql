-- ============================================================================
-- AXONETIS Phase 3 — Routing Config Source of Truth (Founder Lock)
-- ----------------------------------------------------------------------------
-- Adds agent_registry.routing_config (JSONB) and backfills the LOCKED model
-- assignment for the 11 Builder agents (Jimmy, Sherlock, 8 Advisors, Router).
--
-- Backend rule (LOCKED):
--   Server MUST read routing_config at runtime. NO hardcoded switch/case
--   in router.service.ts. Order: OpenRouter → Groq (speed) → Ollama (last).
--
-- This migration DOES NOT touch Rapid Pay agents (Supabase 2, future).
-- Apply on Hetzner self-hosted Supabase 3 only.
-- ============================================================================

-- 1) Add routing_config column (idempotent)
alter table public.agent_registry
  add column if not exists routing_config jsonb not null default '{}'::jsonb;

create index if not exists idx_agent_registry_routing_config
  on public.agent_registry using gin (routing_config);

-- 2) Backfill LOCKED routing_config + correct model_primary / model_fallback
--    for every Builder agent. UPDATE (rows already seeded by prior migration).

-- ---- Jimmy ----------------------------------------------------------------
update public.agent_registry set
  model_primary  = 'hermes-3-llama-3.1-405b',
  model_fallback = array['qwen3-coder-480b-a35b','qwen3-next-80b-a3b-instruct'],
  routing_config = jsonb_build_object(
    'primary', jsonb_build_object(
      'provider', 'openrouter',
      'models', jsonb_build_array(
        'hermes-3-llama-3.1-405b',
        'qwen3-coder-480b-a35b',
        'qwen3-next-80b-a3b-instruct'
      ),
      'roles', jsonb_build_object(
        'reasoning', 'hermes-3-llama-3.1-405b',
        'coding', 'qwen3-coder-480b-a35b',
        'coding_fallback', 'qwen3-next-80b-a3b-instruct'
      )
    ),
    'secondary', jsonb_build_object(
      'provider', 'groq',
      'mode', 'speed_acceleration'
    ),
    'last_resort', jsonb_build_object(
      'provider', 'ollama',
      'models', jsonb_build_array('qwen3:8b')
    ),
    'memory_target_messages', 3000000
  )
where slug = 'jimmy';

-- ---- Sherlock -------------------------------------------------------------
update public.agent_registry set
  model_primary  = 'deepseek-r1',
  model_fallback = array['hermes-3-llama-3.1-405b','gpt-oss-120b'],
  routing_config = jsonb_build_object(
    'primary', jsonb_build_object(
      'provider', 'openrouter',
      'models', jsonb_build_array(
        'deepseek-r1',
        'hermes-3-llama-3.1-405b',
        'gpt-oss-120b'
      ),
      'roles', jsonb_build_object(
        'infrastructure', 'deepseek-r1',
        'investigation', 'hermes-3-llama-3.1-405b',
        'verification', 'gpt-oss-120b'
      )
    ),
    'secondary', jsonb_build_object(
      'provider', 'groq',
      'mode', 'speed_acceleration'
    ),
    'last_resort', jsonb_build_object(
      'provider', 'ollama',
      'models', jsonb_build_array('qwen3:8b')
    ),
    'memory_target_messages', 1000000
  )
where slug = 'sherlock';

-- ---- 8 Industry Advisors --------------------------------------------------
update public.agent_registry set
  model_primary  = 'gpt-oss-120b',
  model_fallback = array['llama-3.3-70b-instruct'],
  routing_config = jsonb_build_object(
    'primary', jsonb_build_object(
      'provider', 'openrouter',
      'models', jsonb_build_array('gpt-oss-120b','llama-3.3-70b-instruct')
    ),
    'secondary', jsonb_build_object(
      'provider', 'groq',
      'mode', 'speed_acceleration'
    ),
    'last_resort', jsonb_build_object(
      'provider', 'ollama',
      'models', jsonb_build_array('qwen3:4b')
    ),
    'memory_target_messages', 100000
  )
where slug in ('aria','orion','rex','lyra','sage','atlas','vega','kai');

-- ---- Global Router --------------------------------------------------------
update public.agent_registry set
  model_primary  = 'llama-3.3-70b-instruct',
  model_fallback = array[]::text[],
  routing_config = jsonb_build_object(
    'primary', jsonb_build_object(
      'provider', 'openrouter',
      'models', jsonb_build_array('llama-3.3-70b-instruct')
    ),
    'secondary', jsonb_build_object(
      'provider', 'groq',
      'mode', 'speed_acceleration'
    )
  )
where slug = 'router';

-- 3) Guard rail: forbid empty routing_config on Builder agents
do $$
declare missing int;
begin
  select count(*) into missing
  from public.agent_registry
  where kind in ('supreme','advisor','router')
    and (routing_config = '{}'::jsonb or routing_config is null);
  if missing > 0 then
    raise exception 'Phase 3 routing_config missing for % Builder agent row(s)', missing;
  end if;
end $$;

-- ============================================================================
-- DONE. Server must now:
--   SELECT routing_config FROM agent_registry WHERE slug = $1
--   → OpenRouter primary.models → Groq speed → Ollama last_resort
--   → insert agent_threads + agent_thread_messages + agent_activity
--   → return reply
-- No switch/case. routing_config is the only source of truth.
-- ============================================================================
