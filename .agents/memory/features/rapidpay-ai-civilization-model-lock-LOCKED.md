---
name: Rapid Pay AI Civilization — Model Assignment Founder Lock (v2)
description: LOCKED model→agent map for Rapid Pay (Supabase 2, future). 19 agents total = 16 core + 3 reserved. Sherlock is SHARED (Builder-owned identity, used here only in 3-guardian security swarm). Source of truth = agent_registry.routing_config — NO hardcoded TS routing.
type: constraint
---

# RAPID PAY AI CIVILIZATION — FOUNDER LOCK v2 (Supabase 2, FUTURE)

> Scope: Rapid Pay agents only. Builder agents (Jimmy/Sherlock/8 Advisors/Router) live in `model-assignment-source-of-truth-LOCKED.md`. Do NOT duplicate.
> Implementation target: **Supabase 2**, AFTER AXONETIS Builder (Supabase 3) is finished.
> Runtime routing source of truth: **`agent_registry.routing_config`** in Supabase 2. NEVER hardcode model assignments in TypeScript.

---

## Agent Count (LOCKED) — 19 total

```
Supreme Layer ............. 2  (Jimmy, Sherlock*)
Treasury Civilization ..... 9
Intelligence Layer ........ 4
Global Routing Layer ...... 1
                          ----
Core total ............... 16
+ Reserved (future) ....... 3   (Compliance / KYC-AML / Dispute)
                          ----
Grand total .............. 19
```

\* **Sherlock is SHARED** — primary identity belongs to AXONETIS Builder (Supabase 3). In Rapid Pay (Supabase 2) Sherlock is invoked ONLY as the lead of the 3-guardian hacker-defense swarm. He is NOT a Rapid-Pay-native agent and does NOT get a separate Rapid Pay personality, memory bucket, or chat surface — same Sherlock, dispatched here for security duty.

---

## 1. Supreme Layer (2)

### AI Jimmy — CEO Autopilot of the company
- **Reasoning:** Hermes 3 Llama 3.1 405B
- **Coding:** Qwen3 Coder 480B A35B
- **Fallback (coding):** Qwen3 Next 80B A3B Instruct

### AI Sherlock — shared security lead (Builder-owned identity)
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

## 5. Security Guardians (3) — 24/7 hacker-defense swarm inside Supabase 2

These three operate as the always-on security swarm. They are NOT extra agents — they are existing identities tagged for security duty:

1. **AI Sherlock** (shared, Builder-owned) — lead investigator → DeepSeek R1 + Hermes 405B + GPT-OSS 120B
2. **AI Fraud Radar** (Treasury) — real-time fraud blocker → Llama 3.3 70B → escalate DeepSeek R1
3. **AI Treasury Sentinel** (Treasury) — anomaly + risk monitor → Llama 3.3 70B → escalate DeepSeek R1

---

## 6. Reserved Slots (3) — future Rapid Pay specialists

| Slot | Default Primary | Escalation | Likely Purpose |
|---|---|---|---|
| Reserved-1 | Llama 3.3 70B Instruct | DeepSeek R1 | Compliance |
| Reserved-2 | Llama 3.3 70B Instruct | DeepSeek R1 | KYC / AML |
| Reserved-3 | Llama 3.3 70B Instruct | DeepSeek R1 | Dispute / Reconciliation |

Founder names them when ready. Do NOT create another file — extend this one.

---

## 7. Provider Hierarchy (ALL Rapid Pay agents — LOCKED)

```
Primary    → OpenRouter
Secondary  → Groq         (speed acceleration only, no fixed model)
Last Resort→ Local Ollama (qwen3:8b for Supreme, qwen3:4b for Treasury/Intelligence)
```

---

## 8. Backend Rules (DO NOT DEVIATE)

1. **NO hardcoded agent model routing in TypeScript.** No `switch/case` in `router.service.ts`. Anything that hardcodes models is wrong and must be deleted.
2. **Source of truth = `agent_registry.routing_config`** (Supabase 3 for Builder, Supabase 2 for Rapid Pay). Always read at runtime.
3. **Routing order LOCKED:**
   ```
   read routing_config
     → OpenRouter (primary)
     → Groq (speed fallback)
     → Ollama (last resort)
   → insert agent_threads + agent_thread_messages + agent_activity
   → return reply
   ```
4. **Rapid Pay civilization is NOT part of Supabase 3.** Implemented later in Supabase 2.
5. **Sherlock is shared, not duplicated.** No second Sherlock identity, memory bucket, or registry row in Supabase 2 — security swarm invokes the Builder-side Sherlock.

---

## 9. Endpoint Contracts

### Builder (Phase 3, Supabase 3) — must implement exactly:
- `GET  /api/agents`
- `POST /api/agents/:slug/chat`
- `POST /api/agents/sherlock/scan`
- `GET  /api/agents/threads`
- `GET  /api/agents/threads/:id/messages`
- `GET  /api/agents/:slug/memory`
- `POST /api/agents/:slug/memory`
- `GET  /api/agents/activity`
- `GET  /api/agents/activity/stream` (SSE)
- `POST /api/agents/router/route`

### Rapid Pay (Supabase 2, future — reserve namespace now):
- `GET  /api/rapidpay/agents`
- `POST /api/rapidpay/agents/:slug/chat`
- `POST /api/rapidpay/agents/fraud-radar/scan`
- `POST /api/rapidpay/agents/treasury-sentinel/scan`
- `POST /api/rapidpay/security/sherlock/scan` (proxies to shared Sherlock)
- `GET  /api/rapidpay/agents/threads`
- `GET  /api/rapidpay/agents/threads/:id/messages`
- `GET  /api/rapidpay/agents/:slug/memory`
- `POST /api/rapidpay/agents/:slug/memory`
- `GET  /api/rapidpay/agents/activity`
- `GET  /api/rapidpay/agents/activity/stream` (SSE)
- `POST /api/rapidpay/agents/router/route`
- `POST /api/rapidpay/swarm/dispatch` (parallel multi-agent fan-out)
- `GET  /api/rapidpay/swarm/:runId/stream` (SSE swarm progress)

Same routing_config → OpenRouter → Groq → Ollama chain.

---

## 10. Enforcement
- This file + `model-assignment-source-of-truth-LOCKED.md` together = full model lock. Any conflict elsewhere → these two files win.
- NO DUPLICATE: do not create another Rapid Pay model file. Extend this one.
- Total agent count is **19** (16 core + 3 reserved). Do not invent more.
- LOCKED Jun 13 2026 (v2 — Sherlock clarified as shared, count corrected from 22 → 19).
