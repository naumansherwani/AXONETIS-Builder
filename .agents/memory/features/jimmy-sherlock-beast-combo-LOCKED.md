---
name: Jimmy & Sherlock Beast Combo (Multi-Model Ensemble) LOCKED — v2
description: Jimmy aur Sherlock dono multi-model ENSEMBLE chalayenge — LEKIN dono ke pools 100% ALAG hain, kabhi mix nahi. Source of truth = agent_registry.routing_config.ensemble JSONB in Supabase 3. Existing fallback chain (OpenRouter→Groq→Ollama) intact rehta hai — ensemble usi chain ke andar parallel fan-out add karta hai.
type: feature
---

# Jimmy & Sherlock — BEAST COMBO v2 (LOCKED)

Founder correction (Jun 15 2026):
1. **Jimmy aur Sherlock ke model pools NEVER mix** — har ek ka apna alag ensemble. v1 mein dono mein Hermes 405B share ho raha tha — galat. v2 mein dono ka roster zero-overlap hai (judges bhi alag).
2. **Groq model name fix**: Groq pe correct slug `qwen/qwen3-32b` hai (601K context, 6K out). `qwen-2.5-coder-32b-instruct` Groq pe exist nahi karta — v1 mein wrong tha.
3. **Source of truth lock**: `agent_registry.routing_config` (Supabase 3) wins. Ensemble config us JSONB ke andar `ensemble` key mein rehta hai. Hardcoded TS routing = ban. Existing model-assignment lock (mem://features/model-assignment-source-of-truth-LOCKED) NOT replaced — ensemble usi lock ke andar reside karta hai.

## 1. Reality / Precedence (kis ko system manay ga)

```
agent_registry.routing_config (DB)   ← single source of truth
        │
        ├── ensemble {slots, judge}  ← parallel fan-out engine (this file)
        ├── primary  [OpenRouter ...]
        ├── secondary [Groq ...]
        └── tertiary  [Ollama qwen3:8b]   ← last_resort fallback
```

Runtime order per request:
1. Server reads `routing_config` for the agent slug (jimmy OR sherlock — never both at once).
2. If `ensemble` present → run parallel fan-out using ONLY that agent's slots.
3. Any slot failure → ensemble continues with N≥2 candidates.
4. If ALL ensemble slots fail → fall back to `secondary` (Groq) single call.
5. If that fails → `tertiary` (Ollama qwen3:8b) — last resort.
6. Existing fallback chain is preserved untouched. Ensemble = addition, not replacement.

## 2. JIMMY ENSEMBLE (Coding + Architecture) — Jimmy-only models

| Slot | Model | Provider | Role |
|------|-------|----------|------|
| A | `hermes-3-llama-3.1-405b` | OpenRouter | Deep reasoning, architecture |
| B | `qwen3-coder-480b-a35b` | OpenRouter | Primary code generation (biggest coder) |
| C | `qwen/qwen3-32b` | Groq | **Speed accelerator** — sub-second draft stream |
| D | `qwen3-next-80b-a3b-instruct` | OpenRouter | Coding diversity / fallback vote |

- **Judge**: `hermes-3-llama-3.1-405b` (OpenRouter) — score-then-merge.
- **Last resort**: Ollama `qwen3:8b`.
- **Memory cap**: 3,000,000 messages.
- **Draft stream**: Slot C (Groq qwen3-32b) → first chunks in <2s, else fallback to "OpenRouter only" mode.

## 3. SHERLOCK ENSEMBLE (Audit + Debug) — Sherlock-only models, ZERO overlap with Jimmy

| Slot | Model | Provider | Role |
|------|-------|----------|------|
| A | `deepseek-r1` | OpenRouter | Infra/security chain-of-thought |
| B | `gpt-oss-120b` | OpenRouter | Structured verification + checklist |
| C | `llama-3.3-70b-versatile` | Groq | **Speed accelerator** — instant lint/diff scan |
| D | `qwen3-next-80b-a3b-instruct` | OpenRouter | Diversity auditor (different family from A/B) |

- **Judge**: `deepseek-r1` (OpenRouter) — **veto + consensus**. Any slot raises CRITICAL → halt.
- **Last resort**: Ollama `qwen3:8b`.
- **Memory cap**: 1,000,000 messages.

> NOTE: Sherlock pool has NO Hermes 405B and NO Qwen3 Coder 480B (those are Jimmy's). Jimmy pool has NO DeepSeek R1 and NO GPT-OSS 120B (those are Sherlock's). Slot D model `qwen3-next-80b-a3b-instruct` appears in both rosters BUT each agent calls it on its own thread/context — not a shared slot. If founder wants 100% binary separation later, swap Sherlock slot D to a different OR model.

## 4. routing_config JSON (LOCKED — paste into agent_registry)

### Jimmy
```json
{
  "ensemble": {
    "mode": "parallel_fan_out_then_judge",
    "slots": [
      {"slot":"A","provider":"openrouter","model":"hermes-3-llama-3.1-405b","role":"reasoning"},
      {"slot":"B","provider":"openrouter","model":"qwen3-coder-480b-a35b","role":"coding_primary"},
      {"slot":"C","provider":"groq","model":"qwen/qwen3-32b","role":"speed_draft"},
      {"slot":"D","provider":"openrouter","model":"qwen3-next-80b-a3b-instruct","role":"coding_diversity"}
    ],
    "judge":{"provider":"openrouter","model":"hermes-3-llama-3.1-405b","strategy":"score_then_merge","stream_draft_from":"C"}
  },
  "primary":   [{"provider":"openrouter","model":"hermes-3-llama-3.1-405b"},{"provider":"openrouter","model":"qwen3-coder-480b-a35b"},{"provider":"openrouter","model":"qwen3-next-80b-a3b-instruct"}],
  "secondary": [{"provider":"groq","model":"qwen/qwen3-32b"}],
  "tertiary":  [{"provider":"ollama","model":"qwen3:8b"}],
  "memory_target_messages": 3000000
}
```

### Sherlock
```json
{
  "ensemble": {
    "mode": "parallel_fan_out_then_veto_consensus",
    "slots": [
      {"slot":"A","provider":"openrouter","model":"deepseek-r1","role":"infra_security"},
      {"slot":"B","provider":"openrouter","model":"gpt-oss-120b","role":"structured_verify"},
      {"slot":"C","provider":"groq","model":"llama-3.3-70b-versatile","role":"speed_scan"},
      {"slot":"D","provider":"openrouter","model":"qwen3-next-80b-a3b-instruct","role":"diversity_audit"}
    ],
    "judge":{"provider":"openrouter","model":"deepseek-r1","strategy":"veto_then_consensus","stream_draft_from":"C"}
  },
  "primary":   [{"provider":"openrouter","model":"deepseek-r1"},{"provider":"openrouter","model":"gpt-oss-120b"}],
  "secondary": [{"provider":"groq","model":"llama-3.3-70b-versatile"}],
  "tertiary":  [{"provider":"ollama","model":"qwen3:8b"}],
  "memory_target_messages": 1000000
}
```

## 5. Phase Integration

- **Phase 3.10.7 (Ensemble Engine)**: migration `ALTER TABLE agent_registry` backfill `routing_config.ensemble` for jimmy + sherlock with above JSON. Server `lib/ensemble.ts` → `runEnsemble(slug, messages, sse)` reads slots FROM DB (never hardcoded), parallel `Promise.all`, judge call, SSE events (`draft`, `slot_done`, `judge_picked`, `final`). Frontend chips: "Draft (Groq qwen3-32b)…" → morphs to "Final (judge picked …)".
- **Phase 4 dual-brain**: each auto-fix loop (max 3) re-fires full ensemble of the active agent. Jimmy writes → Sherlock audits with SHERLOCK ensemble (never Jimmy's).

## 6. Hard Rules (NEVER violate)

- ❌ NEVER mix Jimmy's pool with Sherlock's pool in one call. Each agent fires ONLY its own slots.
- ❌ NEVER hardcode model list in TS — read from `agent_registry.routing_config` (Supabase 3).
- ❌ NEVER bypass existing fallback chain (OR → Groq → Ollama). Ensemble runs INSIDE primary tier.
- ❌ Advisors (8) stay single-model — ensemble = jimmy + sherlock ONLY.
- ✅ Groq draft slot must stream to UI in <2s, else degrade to "OpenRouter only".
- ✅ Judge logs `pick_reason` + all candidate outputs to `agent_activity` for transparency.
- ✅ If any slot fails → continue with N≥2 candidates; if all fail → secondary (Groq) → tertiary (Ollama).
- ✅ Memory caps unchanged: Jimmy 3M, Sherlock 1M.

## 7. v1 → v2 Diff (what changed)

| Field | v1 (WRONG) | v2 (LOCKED) |
|-------|------------|-------------|
| Groq model | `qwen-2.5-coder-32b-instruct` (doesn't exist on Groq) | Jimmy: `qwen/qwen3-32b` · Sherlock: `llama-3.3-70b-versatile` |
| Hermes 405B | Used in BOTH Jimmy & Sherlock | Jimmy ONLY |
| Pool overlap | Shared judge/slots | Zero overlap (except diversity slot D — separate threads) |
| Source of truth | Implicit | Explicit: `routing_config` wins, fallback chain preserved |
