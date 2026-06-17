---
name: NO API / NO Webhook / NO WebSocket / NO Python — Rust-Only LOCKED
description: Founder hard lock (Jun 17 2026). AXONETIS runtime Rust-only. Jimmy + Sherlock ensemble replace every API/webhook/websocket/Python glue layer. SSE over plain HTTP allowed (axum response stream) — woh "WebSocket" nahi hai. Future kaam isi rule ke mutabiq.
type: constraint
---

# NO API / NO Webhook / NO WebSocket / NO Python (LOCKED)

Founder rule (Jun 17 2026, restated after Rust runtime live on Hetzner with Jimmy+Sherlock 4-slot ensemble):

## Banned (NEVER use as primary runtime/intelligence layer)
- ❌ Generic REST API glue as the "brain"
- ❌ Webhooks (incoming/outgoing) as orchestration glue
- ❌ WebSockets (Socket.io, ws://) — full-duplex socket layer banned
- ❌ Python runtime anywhere in product path (FastAPI, Flask, scripts)
- ❌ Node/TS server "brains" that try to do what Jimmy/Sherlock should

## Allowed
- ✅ **Rust** axum HTTP server (already live: `/chat/jimmy`, `/chat/sherlock` on :8088)
- ✅ **Server-Sent Events (SSE)** over plain HTTP — one-way stream, this is NOT a WebSocket
- ✅ Outbound HTTPS to OpenRouter / Groq (model inference only — not "API glue")
- ✅ Outbound HTTPS to Supabase 3 REST for `agent_activity` logging (data layer, not intelligence)
- ✅ Ollama local (last-resort fallback)

## Replacement Doctrine
Jo kaam pehle webhook/API/WebSocket/Python karta tha — ab **Jimmy + Sherlock ensemble** karega:
- Webhook trigger → Jimmy heartbeat loop + Sherlock audit loop (already running every 60s in `main.rs`)
- API orchestration → Jimmy ensemble (4 slots + judge) decides + executes
- WebSocket live updates → SSE stream from axum
- Python ML/scripting → Rust + model inference via OpenRouter/Groq

## Current Rust Runtime (locked baseline)
- Repo: `NEXATECT-Engine` (GitHub: naumansherwani/NEXATECT-Engine)
- Server path: `/root/hostflow-engine/` on Hetzner
- Endpoints: `POST /chat/jimmy`, `POST /chat/sherlock`
- Ensembles match `mem://features/jimmy-sherlock-beast-combo-LOCKED.md` 1:1 (4 slots each, zero overlap pools, separate judges)
- Heartbeat: 60s self-loop printing Jimmy + Sherlock status
- Logging: `agent_activity` table in Supabase 3 via REST

## Next Steps (Phase B — Rust-only, no banned tech)
1. **SSE streaming endpoints** on axum: `GET /chat/jimmy/stream`, `GET /chat/sherlock/stream`, `GET /activity/stream` — token-by-token via `axum::response::sse`. NO WebSocket.
2. **Builder UI rewire** — UnifiedChat already uses `EventSource` (SSE). Point it at Rust runtime (`https://aiaxonetis.hostflowai.net/chat/jimmy/stream`).
3. **Auto-fix dual-brain loop** in Rust: Jimmy writes → Sherlock audits → max 3 iterations → final. Pure Rust `tokio::spawn`, no webhook callbacks.
4. **Tool execution** (file write, git commit, deploy) — Rust functions Jimmy calls directly via judge output JSON. NO external API orchestrator.
5. Phase 3.9 deploy-hook → Rust git+pm2 invocation, NOT a webhook receiver.

## Enforcement
- Any future spec mentioning "add a webhook", "add WebSocket", "Python script", "API gateway as brain" = REJECT and point at this file.
- SSE is the only streaming primitive allowed.
- All new runtime code goes in `NEXATECT-Engine` Rust repo, founder copy-paste workflow preserved.
