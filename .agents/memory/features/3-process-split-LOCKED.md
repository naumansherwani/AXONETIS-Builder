---
name: 3-Process Architecture Split LOCKED (Option B)
description: Final split for axonetis-builder (UI), axonetis-rust-human (brain), hostflow-server (bridge). Locked Jun 24 2026.
type: feature
---

# 3-PROCESS SPLIT — LOCKED Jun 24 2026

Founder approved Option B. Saari future work is split ke hisaab se hi.

## 🟦 axonetis-builder (PM2 id 4, this Lovable TanStack repo)
**Path:** `/opt/hostflow-ecosystem/rapid-dialogue-guide`
**Role:** UI + thin proxy ONLY. ZERO LLM calls here.

- Pura Builder frontend (chat, sidebar, preview iframe, files, versions, domains, publish)
- TanStack server routes `src/routes/api/*` sirf:
  - Supabase 3 reads/writes (thread msgs, projects, files metadata)
  - Proxy/forward to Rust `:8088/chat/*`
  - Proxy/forward to hostflow-server bridge
- NO OpenRouter/Groq/Ollama clients here. (`bun add ai @openrouter/... @ai-sdk/groq ollama-ai-provider-v2` jo hua = unused dead deps, harm nahi.)
- Founder workflow: Lovable → git push → founder `cd /opt/hostflow-ecosystem/rapid-dialogue-guide && git pull && pm2 restart axonetis-builder`

## 🟥 axonetis-rust-human (PM2 id 7, NEXATECT-Engine Rust :8088)
**Role:** AI brain. SAB LLM calls yahan.

- Jimmy ensemble (Hermes 405B + Qwen3 Coder 480B + Groq + Qwen3 Next)
- Sherlock ensemble (DeepSeek R1 + GPT-OSS 120B + Groq + Qwen3 Next) + 3-loop auto-fix
- 8 Advisors single-model
- OpenRouter 3-key hybrid tier (OR1 paid / OR2-3 free)
- SSE endpoints: `/chat/jimmy`, `/chat/sherlock`, `/chat/advisor/<slug>`
- Routing config: read from Supabase 3 `agent_registry.routing_config`
- Replies: write to Supabase 3 `agent_thread_messages` (Realtime triggers UI)
- Heartbeat 60s, ensemble judge/merge, cost tracking
- Founder manages this repo manually.

## 🟩 hostflow-server (PM2, Node bridge)
**Role:** Files/projects/deploy/GitHub glue.

- `project_files` truth + Realtime + 5min checksum sync
- GitHub token operations (axonetis-builder repo writes)
- Publish flow (sandbox → prod, atomic promote, pm2 reload)
- Domains/versions/tools registry CRUD
- Mirror tables sync Supabase 1 ↔ 3

## RULES
- Lovable NEVER edits Rust repo or hostflow-server repo.
- Builder repo NEVER imports OpenRouter/Groq/Ollama SDKs (proxy only).
- Brain code goes in Rust. Glue code goes in hostflow-server. UI + thin proxy in builder.
- Phase A.1 reply path: UI → `/api/agents/chat` (builder) → Supabase 3 insert + forward to Rust `:8088/chat/jimmy` → Rust writes assistant reply → Realtime → UI.
