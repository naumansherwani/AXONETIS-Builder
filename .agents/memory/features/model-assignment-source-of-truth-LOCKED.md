---
name: AXONETIS Model Assignment — Founder Lock (Source of Truth)
description: LOCKED model→agent mapping (Jimmy, Sherlock, 8 advisors, Router) with provider tiers and memory limits. DO NOT invent mappings.
type: constraint
---

# AXONETIS Founder Lock — Model Assignment Source of Truth

**DO NOT invent model mappings.** Anything not listed here is wrong.

## Jimmy
- **Primary — OpenRouter:**
  - Hermes 3 Llama 3.1 405B (reasoning)
  - Qwen3 Coder 480B A35B (coding)
  - Qwen3 Next 80B A3B Instruct (coding fallback)
- **Secondary — Groq:** speed acceleration only, no fixed model
- **Tertiary — Ollama:** `qwen3:8b`

## Sherlock
- **Primary — OpenRouter:**
  - DeepSeek R1 (infrastructure intelligence)
  - Hermes 3 Llama 3.1 405B (deep investigation)
  - GPT-OSS 120B (structured verification)
- **Secondary — Groq:** speed acceleration only, no fixed model
- **Tertiary — Ollama:** `qwen3:8b`

## Industry Advisors (Aria, Orion, Rex, Lyra, Sage, Atlas, Vega, Kai)
- **Primary — OpenRouter:**
  - GPT-OSS 120B
  - Llama 3.3 70B Instruct
- **Secondary — Groq:** speed acceleration only
- **Tertiary — Ollama:** `qwen3:4b`

## Global Router
- **Primary — OpenRouter:** Llama 3.3 70B Instruct
- **Secondary — Groq:** speed acceleration only

## Memory Limits (Founder Lock)
- Jimmy: **3,000,000** messages
- Sherlock: **1,000,000** messages
- Each Industry Advisor: **100,000** messages

## Scope Boundaries
- **Rapid Pay Civilization is NOT part of Supabase 3 implementation.**
- AI Autonomous Rapid Pay agents → implemented later in **Supabase 2**, after AXONETIS Builder project is finished.

## Enforcement
- Any future agent_registry seed / server gateway routing / failover chain MUST match this file 1:1.
- If a spec elsewhere conflicts with this file, **this file wins**.
