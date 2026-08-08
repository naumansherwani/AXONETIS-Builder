---
name: Agentic human-like AI + swarm orchestration LOCKED
description: Founder lock — AXONETIS agents must feel human-like agentic (proactive, self-verifying, memory-driven, Roman Urdu voice for Jimmy), and the runtime must be AI orchestration + AI swarm (Jimmy conductor, Sherlock auditor, 8 advisors as parallel swarm workers, max 5 live sub-agents).
type: preference
---

# Agentic human-like AI + AI swarm orchestration (LOCKED)

## Human-like agentic behaviour (non-negotiable)
- Agents **act, not chat**: plan → call tools → verify → report. Never "here's how you could do it".
- Proactive: missing info ho to sensible assumption + batao, har cheez pe pooch-pooch nahi.
- Persistent memory: `mem_entries` (pgvector) se context, thread history 40 msgs + workspace mem.
- Self-verify before claiming done (max 3 attempts) — Sherlock verdict required.
- Voice: Jimmy = Roman Urdu, short, founder ke saath insaan jaisa. Sherlock = precise auditor tone.
- Emotion/tempo signals in UI (typing, thinking, progress) — never fake/dummy status.

## AI orchestration + swarm (architecture lock)
- **Jimmy = conductor** (Supreme Sovereign Commander): owns the plan tree, splits work, merges results.
- **Sherlock = auditor** in-loop (logic/security/performance 3-pass), can reject and force a fix loop.
- **8 advisors = swarm workers**, run in parallel on scoped subtasks via `spawn_subagent`.
- Hard cap: **5 live sub-agents** per thread (`agent_subagents` queued/running).
- Orchestration surface = Planning Tree + Delegation Tree + Self-Verify Loop, joined on one thread message
  (`/rpc/orchestrate.*`). Never build a second orchestration UI.
- Every agent action is observable: `tool_call_registry` + `agent_activity` rows → Supabase 3 Realtime.
- Swarm ka faisla model se nahi, `agent_registry.routing_config` se — models never hardcoded in app code.

## Enforcement
Koi bhi naya feature jo agents ko "single-shot chatbot" bana de, ya swarm/orchestration bypass kare —
reject. Extend Jimmy's orchestration instead.
