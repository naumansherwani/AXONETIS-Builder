---
name: Unified Chat Scope — Founder Lock
description: Unified Build Chat is Jimmy + Sherlock + Founder ONLY. 8 industry advisors do NOT appear here.
type: constraint
---

# Unified Chat Scope (LOCKED)

**Unified Build Chat = Founder + Jimmy + Sherlock. NOTHING ELSE.**

## Flow
1. Founder tells Jimmy what to build.
2. Jimmy writes code.
3. Sherlock audits Jimmy's code (auto-fix loop, max 3).
4. Sherlock approves → final structure locked → ready for preview/deploy.
5. Chat is primarily with Jimmy. Sherlock chimes in only when needed (issue found, fix applied, approval/rejection).

## What Unified Chat is NOT
- NOT a place for the 8 industry advisors (Aria, Orion, Rex, Lyra, Sage, Atlas, Vega, Kai).
- NOT a router/dispatcher UI for all 11 agents.
- Advisors have their own surface (AgentsPanel / industry-specific chat). Never inject advisor messages into Unified Chat.

## SSE endpoint reuse
- `/api/agents/:slug/stream` is generic and works for all 11 agents — that is fine on the backend.
- Frontend wiring is split:
  - **UnifiedChat.tsx** subscribes only to `jimmy` and `sherlock` streams.
  - **AgentsPanel / advisor surfaces** subscribe to the 8 advisor slugs separately.

## Enforcement
Any future change that adds advisor presence chips, advisor messages, or advisor routing into UnifiedChat violates this lock and must be rejected.
