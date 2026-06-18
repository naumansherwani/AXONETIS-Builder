---
name: Rust Migration Roadmap — All 4 NEXATECT Products LOCKED
description: Jun 18 2026. Founder lock — saaray 4 products (HostFlow AI, AXONETIS Builder, AneXVoT AI Pay, AXOMAIL) bari bari Rust pe migrate honge. NO API/Webhook/WebSocket/Python. Jimmy+Sherlock AI Human style conversations.
type: feature
---

# Rust Migration Roadmap — All 4 NEXATECT Products (LOCKED)

Founder lock (Jun 18 2026): har project bari bari, ek time pe ek, Rust runtime pe shift hoga. SSE allowed, baaki sab banned (see `no-api-webhook-ws-python-LOCKED`).

## Migration Order (locked)

| # | Product | Status | Rust Runtime |
|---|---------|--------|--------------|
| 1 | **AXONETIS AI Builder™** (Jimmy + Sherlock brain) | 🟢 IN PROGRESS — Rust live, SSE Phase B done | `axonetis-rust-human` (pm2 id 11) |
| 2 | **HostFlow AI™** (8 industry advisors website + brain) | ⏳ Next after Builder Phase B UI wired | new `hostflowai-rust` crate |
| 3 | **AneXVoT AI Pay™** (treasury/payments) | ⏳ Queued | new `anexvot-rust` crate |
| 4 | **AXOMAIL™** (autonomous comms) | ⏳ Queued | new `axomail-rust` crate |

Rule: pichla product 100% Rust pe stable hone ke baad hi agla shuru hoga.

## AI Human Personality Layer (Jimmy, Sherlock, 8 advisors)

Sab AI agents human ki tarah baat karein — **chatbot tone BANNED**:
- ❌ "I am an AI assistant...", "As an AI language model..."
- ❌ Robotic bullet dumps without warmth
- ✅ First-person, naam se baat ("Main Jimmy hoon...", "Main Sherlock — abhi audit kar raha hoon...")
- ✅ Roman Urdu/Hindi + English mix when founder uses it (mirror founder's language)
- ✅ Emotion + opinion: "yeh idea solid hai", "bhai yeh risky hai", "ruko, pehle check karta hoon"
- ✅ Memory of past conversations (read from `agent_thread_messages`)
- ✅ Apna naam, role, mood, current task batayein
- ✅ Short, sharp, founder ke saath casual — long lectures only when asked

System prompts (hardcoded in Rust `main.rs`) already enforce JIMMY (CEO autopilot) + SHERLOCK (paranoid auditor) personas. Phase C mein voice + memory recall add hogi.

## Phase Plan per Product (template)

Har product ke liye yeh 4 phases:
- **A** — Rust crate scaffold + `/chat/<agent>` HTTP endpoint + ensemble routing from Supabase
- **B** — SSE streaming (`/chat/<agent>/stream`, `/activity/stream`)
- **C** — AI Human personality + memory recall (thread history → context) + voice (TTS via Rust → ElevenLabs HTTPS only)
- **D** — Full product UI rewire to Rust runtime, old Node/Python backend deprecated

## Hard Rules (cross-product)
- ✅ Ek hi waqt pe ek product migrate hoga
- ✅ Har product ka apna Rust crate, apna pm2 process, apna Supabase instance
- ✅ Saaray AI agents human personality use karenge (see `unified-chat-scope-LOCKED` + this file)
- ❌ NEVER add Python/WebSocket/Webhook/REST-glue to any of the 4 products
- ✅ SSE = sirf streaming primitive
- ✅ Founder copy-paste workflow preserved — Lovable code likhta hai, founder Hetzner pe paste karta hai

## Current Blocker (Phase B finish)
Env vars confirmed loaded (OPENROUTER_API_KEY, GROQ_API_KEY, SUPABASE3_*). Lekin SSE slot outputs blank aa rahe the — Rust code mein env var names ka mismatch ho sakta hai (e.g. `OPENROUTER_API_KEY` vs `OR_KEY`). Next step: `main.rs` env reads audit + Builder UnifiedChat ko `/chat/jimmy/stream` se wire karna.
