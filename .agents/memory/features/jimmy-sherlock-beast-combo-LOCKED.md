---
name: Jimmy & Sherlock Beast Combo (Multi-Model Ensemble) LOCKED
description: Jimmy aur Sherlock ko single-model nahi — multi-model ENSEMBLE banao. Parallel fan-out → judge/merge → best answer. Hermes 405B + Qwen3 Coder 480B + Qwen 2.5 Coder 32B + Groq accelerator ek saath chalay. Same logic Sherlock ke liye. Phase 3.10 + Phase 4 mein integrate.
type: feature
---

# Jimmy & Sherlock — BEAST COMBO (Multi-Model Ensemble) LOCKED

Founder request (Jun 15 2026): Jimmy aur Sherlock single-model nahi rahenge. **Multi-model ensemble** banega — saare models **parallel** chalain, phir ek **judge** best answer pick/merge kare. Result: Claude-tier se bhi upar, kyunki har model ki strength mil ke beast banti hai.

## 1. JIMMY BEAST COMBO (Coding + Architecture + Reasoning)

### Parallel fan-out (sab ek saath fire hote hain)
| Slot | Model | Provider | Role |
|------|-------|----------|------|
| A | `hermes-3-llama-3.1-405b` | OpenRouter | Deep reasoning, architecture, product thinking |
| B | `qwen3-coder-480b-a35b` | OpenRouter | Primary code generation (biggest coder) |
| C | `qwen-2.5-coder-32b-instruct` | Groq | **Speed accelerator** — sub-second draft code |
| D | `qwen3-next-80b-a3b-instruct` | OpenRouter | Coding fallback / diversity vote |

### Judge layer
- Judge model: `hermes-3-llama-3.1-405b` (already in slot A, reused)
- Strategy: **score-then-merge**
  - Slot C (Groq Qwen 2.5 Coder 32B) returns first (~0.5–1.5s) → shown as "draft" stream to founder immediately (no waiting).
  - Slots A/B/D complete in 4–12s → judge compares all 4 → picks best OR merges (best architecture from A + best code from B + diff sanity from D).
  - Final answer replaces draft via streaming patch.

### Why this is a beast
1. **Zero perceived latency** — Groq draft instant.
2. **Best-of-N quality** — 4 brains parallel, judge picks winner.
3. **Diversity** — different model families = catches blind spots single model misses.
4. **Cost-controlled** — Groq is cheap+fast; OpenRouter 3 models only when complex (router decides).

## 2. SHERLOCK BEAST COMBO (Audit + Debug + Verify)

### Parallel fan-out
| Slot | Model | Provider | Role |
|------|-------|----------|------|
| A | `deepseek-r1` | OpenRouter | Infra/security reasoning (chain-of-thought) |
| B | `hermes-3-llama-3.1-405b` | OpenRouter | Deep RCA + architectural audit |
| C | `gpt-oss-120b` | OpenRouter | Structured verification + checklist |
| D | `qwen-2.5-coder-32b-instruct` | Groq | **Speed accelerator** — instant lint/diff scan |

### Judge layer
- Judge: `deepseek-r1` (highest reasoning for verdict)
- Strategy: **veto + consensus**
  - Any slot raises CRITICAL → Sherlock blocks (veto power).
  - Otherwise consensus of A/B/C → final verdict.
  - Slot D (Groq) gives instant first-pass while heavy slots run.

### Why beast
- **No bug slips** — 4 auditors with different specialties (security, RCA, structured, fast-scan).
- **Veto = production safety** — single critical finding from any slot = halt.
- **Sherlock auto-fix loop (max 3)** still applies; each retry re-fires full combo.

## 3. Routing Contract (server-side, hostflowai-server)

`agent_registry.routing_config.ensemble` JSONB column drives this. Server MUST:

```js
// pseudocode for /api/agents/jimmy/chat
const cfg = await db.one('select routing_config from agent_registry where slug=$1', ['jimmy'])
const slots = cfg.ensemble.slots          // [{slot:'A', provider, model, role}, ...]
const judge = cfg.ensemble.judge          // {provider, model, strategy}

// 1. Fire Groq slot first → stream draft to client immediately
const draft = streamGroq(slots.find(s => s.provider==='groq'))
sse.send({type:'draft', from:'groq', text:draft})

// 2. Fire other slots in parallel
const heavy = await Promise.all(
  slots.filter(s=>s.provider!=='groq').map(s => callOpenRouter(s))
)

// 3. Judge
const final = await judgeMerge(judge, [draft, ...heavy], userPrompt)
sse.send({type:'final', text:final, picked_from:judge.pick_reason})

// 4. Log all slot outputs + judge decision to agent_activity for transparency
```

## 4. routing_config JSON shape (LOCKED)

### Jimmy
```json
{
  "ensemble": {
    "mode": "parallel_fan_out_then_judge",
    "slots": [
      {"slot":"A","provider":"openrouter","model":"hermes-3-llama-3.1-405b","role":"reasoning"},
      {"slot":"B","provider":"openrouter","model":"qwen3-coder-480b-a35b","role":"coding_primary"},
      {"slot":"C","provider":"groq","model":"qwen-2.5-coder-32b-instruct","role":"speed_draft"},
      {"slot":"D","provider":"openrouter","model":"qwen3-next-80b-a3b-instruct","role":"coding_diversity"}
    ],
    "judge": {
      "provider":"openrouter",
      "model":"hermes-3-llama-3.1-405b",
      "strategy":"score_then_merge",
      "stream_draft_from":"C"
    },
    "last_resort":{"provider":"ollama","models":["qwen3:8b"]},
    "memory_target_messages": 3000000
  }
}
```

### Sherlock
```json
{
  "ensemble": {
    "mode": "parallel_fan_out_then_veto_consensus",
    "slots": [
      {"slot":"A","provider":"openrouter","model":"deepseek-r1","role":"infra_security"},
      {"slot":"B","provider":"openrouter","model":"hermes-3-llama-3.1-405b","role":"rca_deep"},
      {"slot":"C","provider":"openrouter","model":"gpt-oss-120b","role":"structured_verify"},
      {"slot":"D","provider":"groq","model":"qwen-2.5-coder-32b-instruct","role":"speed_scan"}
    ],
    "judge": {
      "provider":"openrouter",
      "model":"deepseek-r1",
      "strategy":"veto_then_consensus",
      "stream_draft_from":"D"
    },
    "last_resort":{"provider":"ollama","models":["qwen3:8b"]},
    "memory_target_messages": 1000000
  }
}
```

## 5. Phase Integration (LOCKED — add to master blueprint)

### Phase 3.10 (Real Agent Loop) — ADD sub-phase **3.10.7 Ensemble Engine**
- Migration: `ALTER TABLE agent_registry` — backfill `routing_config.ensemble` for jimmy + sherlock with JSON above.
- Server: `lib/ensemble.ts` → `runEnsemble(slug, messages, sse)` — parallel `Promise.all`, judge call, SSE events (`draft`, `slot_done`, `judge_picked`, `final`).
- Frontend (this repo, Builder UI): UnifiedChat shows **"Draft (Groq)…"** chip, then morphs to **"Final (Hermes judge picked Qwen3 Coder)"** chip with expandable "see all 4 candidates" diff.
- Cost meter: per-call shows breakdown (4 slot costs + judge cost).
- Telemetry: `agent_activity` row per slot + 1 row for judge verdict.

### Phase 4 (Jimmy & Sherlock Dual-Brain) — UPGRADE
- Dual-brain workflow now uses ensemble on **both sides**: Jimmy ensemble writes code → Sherlock ensemble audits → max 3 auto-fix loops, each loop = full ensemble re-fire.

## 6. Hard Rules (NEVER violate)
- ❌ NEVER bypass ensemble for jimmy/sherlock — even simple queries fire all slots (Groq draft makes it free perceptually).
- ❌ NEVER hardcode model list in server — read from `routing_config.ensemble` (source of truth lock still applies).
- ❌ Advisors (8) stay single-model — ensemble is ONLY for jimmy + sherlock (cost guard).
- ✅ Judge MUST log pick_reason to `agent_activity` for founder transparency.
- ✅ Groq slot draft MUST stream to UI within 2s or fallback to "OpenRouter only" mode.
- ✅ If any slot fails → continue with remaining slots; judge handles N≥2 candidates.
- ✅ Memory limits unchanged (Jimmy 3M, Sherlock 1M).

## 7. Founder copy-paste cadence
1. Lovable ships Phase 3.10.7 Builder UI (ensemble chips, candidate diff viewer, cost breakdown).
2. Lovable generates server snippet: `db/migrations/2026_06_15_phase3.10.7_ensemble.sql` + `server-snippets/ensemble.routes.ts`.
3. Founder pastes on Hetzner → `git pull` → ensemble live.
4. Test: ask Jimmy "build me a Stripe webhook" → see Groq draft in 1s, final merged answer in 8s, judge log visible.
