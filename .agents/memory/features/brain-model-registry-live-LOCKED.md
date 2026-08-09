---
name: Brain model registry LIVE (server 1) LOCKED
description: Live model tiers in /opt/hostflowai-brain/backend/src/routes/founder/jimmy.ts — FREE_MODELS (gemma-4 :free), PAID_MODELS (deepseek-v4-flash, gemini-2.5-flash), FOUNDER_MODELS (hermes-405b, deepseek-v4-pro, deepseek-r1, gemini-3.6-flash, claude-sonnet-4-5) + situation map. Server 2 = ANEXOMAIL, separate.
type: feature
---

# Brain model registry — LIVE on server 1 (LOCKED Aug 8 2026)

Source of truth file: `/opt/hostflowai-brain/backend/src/routes/founder/jimmy.ts`
(Supabase 3 `agent_registry.routing_config` still wins for the bridge worker; this is the brain-side tier map.)

## Tiers
- `FREE_MODELS`: `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free`
- `PAID_MODELS`: `deepseek/deepseek-v4-flash`, `google/gemini-2.5-flash`
- `FOUNDER_MODELS`: `nousresearch/hermes-3-llama-3.1-405b`, `deepseek/deepseek-v4-pro`,
  `deepseek/deepseek-r1`, `google/gemini-3.6-flash`, `anthropic/claude-sonnet-4-5`

Key selection: `isFounder → KEYS.FOUNDER`, `tier free → KEYS.FREE`, else `KEYS.PAID`
(per `features/openrouter-keys-hybrid-tier-LOCKED`).

## Situation map (founder tier)
REASONING `deepseek-r1` · CODE `deepseek-v4-pro` · EMAIL `claude-sonnet-4-5` · CRM `deepseek-v4-pro`
VISION `gemini-2.5-flash` · MULTILANG `gemini-3.6-flash` · FAST `hermes-3-llama-3.1-405b`
Default fallback: `hermes-3-llama-3.1-405b`

## Situation map (paid tier)
EMAIL/VISION/MULTILANG `gemini-2.5-flash` · CODE/REASONING/FAST `deepseek-v4-flash`

## Hosts
- **Server 1** = AXONETIS/NEXATECT brain (this registry).
- **Server 2** = ANEXOMAIL — separate machine, separate registry, never mix.
