---
name: Rapid Pay AI Civilization — Model Assignment Founder Lock
description: LOCKED model→agent map for Rapid Pay (Supabase 2, future). 22 agents incl. 3 security guardians. Source of truth = agent_registry.routing_config (NO hardcoded TS routing). Pairs with model-assignment-source-of-truth-LOCKED.md for Builder side.
type: constraint
---

# RAPID PAY AI CIVILIZATION — FOUNDER LOCK (Supabase 2, FUTURE)

> Scope: This file = Rapid Pay agents only. Builder agents (Jimmy/Sherlock/8 Advisors/Router) live in `model-assignment-source-of-truth-LOCKED.md`. Do NOT mix. Do NOT duplicate.
> Implementation target: **Supabase 2**, AFTER AXONETIS Builder (Supabase 3) is finished.
> Source of truth for routing at runtime: **`agent_registry.routing_config`** in Supabase 2. NEVER hardcode model assignments in TypeScript.

---

## 1. Supreme Layer (shared with Builder identity, separate Rapid Pay instances)

### AI Jimmy
- **Reasoning:** Hermes 3 Llama 3.1 405B
- **Coding:** Qwen3 Coder 480B A35B
- **Fallback (coding):** Qwen3 Next 80B A3B Instruct

### AI Sherlock
- **Infrastructure:** DeepSeek R1
- **Investigation:** Hermes 3 Llama 3.1 405B
- **Verification:** GPT-OSS 120B

---

## 2. Treasury Civilization (9 agents)

| Agent | Primary | Escalation | Purpose |
|---|---|---|---|
| AI Ledger Fox | GPT-OSS 120B | — | Ledger intelligence, transaction analysis, treasury accounting |
| AI Recovery Phantom | Llama 3.3 70B Instruct | — | Payment recovery, customer recovery, retry intelligence |
| AI Treasury Sentinel | Llama 3.3 70B Instruct | DeepSeek R1 | Treasury monitoring, risk detection, treasury health |
| AI Corridor Brain | Llama 3.3 70B Instruct | — | Cross-border routing, corridor optimization |
| AI Treasury Navigator | Llama 3.3 70B Instruct | — | Treasury decisions, fund routing |
| AI Runtime Echo | Llama 3.3 70B Instruct | — | Runtime monitoring, event analysis |
| AI Replay Keeper | Llama 3.3 70B Instruct | — | Audit replay, recovery replay, historical reconstruction |
| AI Settlement Hawk | Llama 3.3 70B Instruct | — | Settlement intelligence, settlement monitoring |
| AI Fraud Radar | Llama 3.3 70B Instruct | DeepSeek R1 | Fraud detection, risk escalation |

---

## 3. Intelligence Layer (4 agents)

| Agent | Primary | Purpose |
|---|---|---|
| AI Treasury Stress Intelligence | Hermes 3 Llama 3.1 405B | Treasury stress testing, scenario simulation |
| AI Revenue Brain | GPT-OSS 120B | Revenue optimization, revenue forecasting |
| AI Explainability Civilization | GPT-OSS 120B | Explain decisions, audit explanations |
| AI Founder Sandbox Civilization | Hermes 3 Llama 3.1 405B | Simulation, strategy testing |

---

## 4. Global Routing Layer (1 agent)

| Agent | Primary | Purpose |
|---|---|---|
| AI Global Router | Llama 3.3 70B Instruct | Agent selection, tool selection, routing, classification |

---

## 5. Security Guardians (3) — inside Supabase 2, hacker defense 24/7

These three operate as the always-on security swarm (separate identities from their general duties):
1. **AI Sherlock** — lead investigator (DeepSeek R1 + Hermes 405B + GPT-OSS 120B)
2. **AI Fraud Radar** — real-time fraud blocker (Llama 3.3 70B → escalate DeepSeek R1)
3. **AI Treasury Sentinel** — anomaly + risk monitor (Llama 3.3 70B → escalate DeepSeek R1)

---

## 6. Agent Count Reconciliation (22 total target)

- Supreme: **2** (Jimmy, Sherlock)
- Treasury: **9**
- Intelligence: **4**
- Global Routing: **1**
- **Subtotal core = 16**
- **+ 6 reserved slots** for future Rapid Pay specialists (Compliance, KYC, AML, Dispute, Reconciliation, Tax) → completes 22.
- Reserved slots default model: **Llama 3.3 70B Instruct**, escalation **DeepSeek R1**. Locked in `agent_registry.routing_config` when added.

> If founder confirms different specialists for the 6 reserved slots, update this section — do NOT create a parallel file.

---

## 7. Provider Hierarchy (ALL Rapid Pay agents — LOCKED)

```
Primary    → OpenRouter
Secondary  → Groq        (speed acceleration only, no fixed model)
Last Resort→ Local Ollama (qwen3:8b for Supreme/Sherlock, qwen3:4b for Treasury/Intelligence)
```

---

## 8. Backend Rules (DO NOT DEVIATE) — applies to BOTH Builder + Rapid Pay

1. **NO hardcoded agent model routing in TypeScript.** No `switch/case` in `router.service.ts`. Anything that hardcodes models is wrong and must be deleted.
2. **Source of truth = `agent_registry.routing_config`** (Supabase 3 for Builder, Supabase 2 for Rapid Pay). Always read at runtime.
3. **Routing order LOCKED:**
   ```
   read routing_config
     → OpenRouter (primary)
     → Groq (speed fallback)
     → Ollama (last resort)
   ```
4. **Memory limits LOCKED:** Jimmy 3,000,000 · Sherlock 1,000,000 · each Industry Advisor 100,000. Rapid Pay agent memory caps to be defined when Supabase 2 phase opens.
5. **Rapid Pay civilization is NOT part of Supabase 3.** Implemented later in Supabase 2.
6. **Phase 3 (Builder) endpoint contract — MUST implement exactly:**
   - `GET /api/agents`
   - `POST /api/agents/:slug/chat` (read routing_config → OpenRouter → Groq → Ollama → insert agent_threads + agent_thread_messages + agent_activity → return reply)
   - `POST /api/agents/sherlock/scan`
   - `GET /api/agents/threads`
   - `GET /api/agents/threads/:id/messages`
   - `GET /api/agents/:slug/memory`
   - `POST /api/agents/:slug/memory`
   - `GET /api/agents/activity`
   - `GET /api/agents/activity/stream` (SSE)
   - `POST /api/agents/router/route`
7. **Rapid Pay endpoint contract (Supabase 2, future — reserve namespace now):**
   - `GET  /api/rapidpay/agents`
   - `POST /api/rapidpay/agents/:slug/chat`
   - `POST /api/rapidpay/agents/sherlock/scan`
   - `POST /api/rapidpay/agents/fraud-radar/scan`
   - `POST /api/rapidpay/agents/treasury-sentinel/scan`
   - `GET  /api/rapidpay/agents/threads`
   - `GET  /api/rapidpay/agents/threads/:id/messages`
   - `GET  /api/rapidpay/agents/:slug/memory`
   - `POST /api/rapidpay/agents/:slug/memory`
   - `GET  /api/rapidpay/agents/activity`
   - `GET  /api/rapidpay/agents/activity/stream` (SSE)
   - `POST /api/rapidpay/agents/router/route`
   - `POST /api/rapidpay/swarm/dispatch` (orchestration entry — fans out to multiple agents in parallel)
   - `GET  /api/rapidpay/swarm/:runId/stream` (SSE swarm progress)
   - **Same routing_config → OpenRouter → Groq → Ollama chain.**

---

## 9. Enforcement
- This file + `model-assignment-source-of-truth-LOCKED.md` together = full model lock. Any conflict elsewhere → these two files win.
- NO DUPLICATE: do not create another Rapid Pay model file. Extend this one.
- Reserved 6 slots stay reserved until founder names them.
- LOCKED Jun 13 2026.
