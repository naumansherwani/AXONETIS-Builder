---
name: OpenRouter 3-Key Hybrid Tier Routing LOCKED Jun 20 2026
description: 3 OpenRouter keys + Groq + Cerebras + Ollama. Key1 = paid (Jimmy primary, next month upgrade). Key2/Key3 = free tier (Sherlock + Advisors + public users). Hybrid tier: free users → free pool only; founder/Jimmy/Sherlock → paid+free pool with failover. Source of truth = agent_registry.routing_config still wins.
type: feature
---

# OpenRouter 3-Key Hybrid Tier Routing (LOCKED)

## Keys & env (Hetzner /root/hostflow-engine/.env)
- `OPENROUTER_API_KEY_1` = **PAID** (next-month upgrade) → Jimmy primary + founder chat
- `OPENROUTER_API_KEY_2` = FREE tier → Sherlock primary + Jimmy failover
- `OPENROUTER_API_KEY_3` = FREE tier → Advisors + public users + Sherlock failover
- `GROQ_API_KEY` = speed-draft accelerator (all tiers)
- `CEREBRAS_API_KEY` = optional speed alternative
- Ollama qwen3:8b / qwen3:4b = last resort, zero cost

## Tier matrix (LOCKED)

| Caller | Pool order |
|---|---|
| Founder chat (Jimmy/Sherlock direct) | OR1 (paid) → OR2 → OR3 → Groq → Ollama |
| Jimmy build agent | OR1 (paid) → OR2 → Groq draft → Ollama qwen3:8b |
| Sherlock audit | OR2 → OR3 → Groq draft → Ollama qwen3:8b |
| 8 Advisors | OR3 → Groq → Ollama qwen3:4b |
| Public/free users (future) | OR3 only → Groq → Ollama qwen3:4b — **never** OR1 paid |
| Pro $20/mo users (future) | OR2 → OR3 → Groq → Ollama qwen3:8b |
| Business $100/mo users (future) | OR1 (paid pool share) → OR2 → Groq → Ollama qwen3:8b — Sherlock included |

## Hard rules
- Free/public users **NEVER** touch `OPENROUTER_API_KEY_1`. Burn-rate protection.
- Per-user daily cap (free tier): 50 Jimmy msgs/day, 20 Sherlock scans/day. Enforced server-side in Rust runtime.
- `agent_registry.routing_config` (Supabase 3) remains source of truth — tier just selects which key the resolver uses for the OR slot.
- Existing Jimmy/Sherlock ensemble pools (mem://features/jimmy-sherlock-beast-combo-LOCKED) untouched — keys just rotate inside the OR slot.
- When OR1 quota hits 80%, alert founder via Sherlock; do not silently fall to OR2 without log.
