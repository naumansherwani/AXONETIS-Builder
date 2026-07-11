---
name: 3-Supabase Bridge Architecture + Jimmy Universal CEO LOCKED
description: Founder-locked (Jun 2026) architecture for how Supabase #1 (HostFlow/Nexatect), #2 (ANEXVOT AI Pay), #3 (Axonetis) connect via Hetzner relay, plus Jimmy Universal CEO plan. Read before ANY cross-product / Jimmy / payment work. Zero duplication mandate.
type: feature
---

# 3-Supabase Bridge + Jimmy Universal CEO (LOCKED — Jun 2026)

**Rule #1:** Supabase-to-Supabase direct connect DOES NOT EXIST. Har Supabase apni duniya hai. Connection hamesha Hetzner bridge (`hostflow-engine`) ke through hota hai.

## Topology

```
                ┌────────────────────────────────────────┐
                │      HETZNER (hostflow-engine)         │
                │   Jimmy Brain + Relay + IMAP mail      │
                │   (Deno/Rust/Bun — sovereign core)     │
                └───────┬──────────┬──────────┬──────────┘
                        │          │          │
              service_role      service_role  service_role
                        │          │          │
        ┌───────────────▼──┐  ┌────▼─────┐  ┌─▼──────────────┐
        │  SUPABASE #1     │  │ SUPA #2  │  │  SUPABASE #3   │
        │  HostFlow AI     │  │ ANEXVOT  │  │  Axonetis      │
        │  (→ Nexatect)    │  │ AI PAY   │  │  Builder       │
        │ • users/auth     │  │ • Polar  │  │ • product data │
        │ • CRM/bookings   │  │   webhook│  │ • own auth     │
        │ • Jimmy convo    │  │ • orders │  │ • project_files│
        │   storage        │  │ • subs   │  │                │
        └──────────────────┘  └──────────┘  └────────────────┘
                 ▲                 │                ▲
                 │                 │ webhook fires  │
                 │                 ▼                │
                 └──── Hetzner relay writes ────────┘
                       plan/subscription updates back into #1 and #3
```

## 3 connection methods (in priority order)

### 1. Hetzner relay — DEFAULT, USE THIS
Hetzner service holds all 3 `service_role` keys in `.env`. Flow:
- Polar webhook → Supabase #2
- #2 edge function → HTTP POST to Hetzner (with `metadata.product`)
- Hetzner routes on `product`:
  - `"nexatect"` → update Supabase #1 `subscriptions`
  - `"axonetis"` → update Supabase #3 `subscriptions`
Already locked in `payment-brain-supabase2.md`.

### 2. Edge function → peer Supabase (fragile, avoid)
Supabase #2 edge fn calls Supabase #1 REST directly using `SUPABASE1_SERVICE_ROLE_KEY` stored as secret in #2. Works but breaks on key rotation. Only use if relay is down.

### 3. postgres_fdw — heavy, only for cross-product analytics
Foreign Data Wrapper. Use only when Jimmy needs combined revenue across products.

## Jimmy = Universal CEO (multi-product)

Currently Jimmy lives in Supabase #1 (`founder_ai_conversations`, `founder_ai_messages`, `founder-adviser` edge fn) = HostFlow-only. To become multi-product:

**A) Context aggregator on Hetzner (partial brain shift)**
- Conversation storage STAYS in #1.
- New Hetzner endpoint `/jimmy/company-state` reads:
  - #1 → HostFlow/Nexatect metrics (MRR, users, churn)
  - #2 → payment metrics (revenue, refunds, active subs, ALL products)
  - #3 → Axonetis metrics (post-launch)
- Merges into unified "company state" JSON → feeds Jimmy prompt.

**B) `product` dimension everywhere**
Every cross-product table gets `product` column: `'nexatect' | 'axonetis' | 'anexvot' | ...`. Polar `metadata.product` already carries it. Jimmy prompts get `product?` param — omit = aggregate all.

## Hard rules (LOCKED — never violate)
- ❌ NEVER attempt Supabase↔Supabase direct connection.
- ❌ NEVER duplicate the relay in Lovable frontend.
- ❌ NEVER put `service_role` keys anywhere except Hetzner `.env`.
- ✅ All cross-product writes go through Hetzner relay.
- ✅ `metadata.product` is the routing key — mandatory in every Polar checkout.
- ✅ Jimmy conversation history stays in Supabase #1. Only aggregation moves to Hetzner.
- ✅ Read this memory BEFORE any Jimmy / payment / cross-product task to prevent duplicate tables, duplicate relays, or duplicate brains.

## Order reminder
ANEXVOT AI Pay is DEFERRED. Axonetis phases first (see `axonetis-active-worklist-LOCKED`). This memory exists so when ANEXVOT phase comes, architecture is pre-locked and zero code is thrown away.
