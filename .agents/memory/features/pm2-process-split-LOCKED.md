---
name: PM2 Process Split — Builder vs Rust LOCKED
description: Hetzner PM2 process map locked Jun 24 2026. Builder-related code goes into axonetis-builder. Rust-related code goes into axonetis-rust-human. GitHub token "axonetis-builder" issued for Builder repo. Never mix the two.
type: feature
---

# PM2 Live Map (Hetzner — LOCKED Jun 24 2026)

```
id  name                  mode  status   purpose
0   aanris-runtime        fork  online   ANRIS runtime (rapidpay sovereign)
1   schema-evolution      fork  online   schema evolution worker
2   hostflowai-brain      fork  online   HostFlow AI brain (qwen3 stack)
3   runtime-schema-sync   fork  online   schema mirror sync
4   axonetis-builder      fork  online   AXONETIS Builder server (Node) — Builder ka ghar
5   hostflow-server       fork  online   HostFlow ops API
7   axonetis-rust-human   fork  online   Rust AI-Human runtime — Rust ka ghar
```

## Routing rules (LOCKED — NEVER MIX)

- **Builder-related** (Jimmy/Sherlock chat SSE, project_files, deploy runner, publish flow, domains, cloud panel, AI Elements composer wiring, OpenRouter/Groq gateway for Builder agents) → **axonetis-builder** process only.
- **Rust-related** (rust-ai-human-runtime, sovereign core, RapidPay rust pieces, anything from `rust-ai-human-runtime-LOCKED` / `rust-migration-roadmap-all-4-products-LOCKED`) → **axonetis-rust-human** process only.
- Never put Builder routes into the Rust process.
- Never put Rust runtime code into the Builder process.

## GitHub token

- Token name: **axonetis-builder** (issued Jun 24 2026).
- Scope: Builder server repo only (`axonetis-builder` / `hostflow-server` Builder snippets).
- Never paste into Lovable repo — token stays on Hetzner + founder GitHub account only (per `phase3.10-jimmy-chatbox-supabase3-wiring-LOCKED`).

## Phase A — Founder Builder 40% remaining (ABHI active, ~35 credits)

Order LOCKED:
1. Supabase 3 SSE wiring + Jimmy/Sherlock chat live (8cr)
2. Server snippet paste + debug (5cr)
3. Publish sandbox→prod flow test (4cr)
4. Sherlock auto-fix 3-loop wiring (4cr)
5. Polish + buffer

All Phase A server work lands in **axonetis-builder** process. Rust process untouched until Rust-specific phase.
