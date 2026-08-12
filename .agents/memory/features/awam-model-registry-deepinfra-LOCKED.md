---
name: AWAM model registry (DeepInfra DI1/DI2) LOCKED Aug 12 2026
description: Master registry /opt/hostflowai-brain/backend/src/config/ai-models.ts — Jimmy awam (claude-sonnet-5 / Qwen3-Coder-480B / DeepSeek-V4-Flash, DI1), Sherlock (R1-0528 → V4-Pro), Aria (gemini-2.5-flash → claude-sonnet-5 → Llama-3.3-70B), Leo on DI2, free tier 5 msgs/day. Repo copy server-snippets/ai-models.registry.ts.
type: feature
---

# AWAM (public) model registry — LOCKED

Server file: `/opt/hostflowai-brain/backend/src/config/ai-models.ts`
Repo copy: `server-snippets/ai-models.registry.ts` (full-file overwrite only)
Install doc: `server-snippets/INSTALL-awam-model-registry.md`

## Providers / keys
- `ENDPOINTS.deepinfra` = `https://api.deepinfra.com/v1/openai/chat/completions`
- `ENDPOINTS.openrouter` = OpenRouter chat completions
- Keys: `DEEPINFRA_API_KEY_1` (DI1 = AXONETIS/awam), `DEEPINFRA_API_KEY_2` (DI2 = ANEXOMAIL/Leo),
  `OPENROUTER_API_KEY_1..3` (OR1 founder paid, OR3 free pool)

## Agent map (awam)
- **JIMMY**: chat/plan `claude-sonnet-5` (DI1) · code `Qwen/Qwen3-Coder-480B-A35B-Instruct` (DI1) ·
  reason `deepseek-ai/DeepSeek-R1-0528` · fallback `deepseek-ai/DeepSeek-V4-Flash` ·
  free `meta-llama/Llama-3.3-70B-Instruct-Turbo`
- **JIMMY FOUNDER** (Nauman only): `anthropic/claude-sonnet-5` → `claude-sonnet-4-6` (OR1)
- **SHERLOCK**: `DeepSeek-R1-0528` → `DeepSeek-V4-Pro` (DI1)
- **LEO** (ANEXOMAIL, DI2): `claude-haiku-4-5` → `DeepSeek-V4-Flash` → Llama-3.1-8B free
- **ARIA** (Phase 1 launch): `google/gemini-2.5-flash` → deep `claude-sonnet-5` → fallback `Llama-3.3-70B-Instruct-Turbo`, vision `Qwen3-VL-235B`
- ORION/VEGA/KAI gemini-2.5-flash · REX/ATLAS DeepSeek-V4-Pro · SAGE Qwen3-235B · LYRA claude-sonnet-5 (OR1 fallback, safety critical)

## Credits / limits
CREDITS: standard 0.5 · advanced 2 · vision 3 · bulk 5
LIMITS: free 5/day 50/mo · basic 50/1000 · pro 200/5000 · premium & founder unlimited

## Hard rules
- Free/awam users **never** touch OR1 paid key. Free pool = OR3 free models + DI1 free slot, hard cap 5 msgs/day.
- Yeh registry sirf **AXONETIS awam** ke liye hai — founder brain tier map (`features/brain-model-registry-live-LOCKED`) alag hai.
- `agent_registry.routing_config` (Supabase 3) bridge worker ke liye still source of truth.
- Keys sirf server env mein — frontend mein kabhi nahi.
