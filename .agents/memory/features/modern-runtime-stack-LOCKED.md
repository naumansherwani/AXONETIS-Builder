---
name: Modern Runtime Stack LOCKED
description: Founder runtime direction — Rust + Bun + SSE/WebTransport + tRPC + direct Supabase SDK, no WebSockets/API glue.
type: feature
---

# LOCKED — Modern production runtime direction

Founder system direction:

- Runtime: **Bun native server** where practical, with existing Rust backend as the sovereign compute/runtime layer.
- Transport: **SSE is current production baseline**. WebSockets are not the product direction. Next transport evolution is **WebTransport over HTTP/3** after current phase wiring is green.
- API layer: **tRPC for type-safety** and zero-API style internal contracts. Do not introduce REST sprawl beyond existing compatibility endpoints already live.
- Database: direct Supabase SDK / PostgREST usage only; no ORM overhead unless founder explicitly approves.
- Security: manual permission system inspired by Deno-style permissions, plus Rust backend guardrails.
- AI: OpenRouter now; long-term direction is self-hosted where practical.

Important sequencing: do not use WebTransport/tRPC modernization as an excuse to skip current wiring. Finish the active blocker first: Phase 3.10.1 Tool Abort must be real working on Hetzner before Phase 3.10.2.