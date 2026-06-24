---
name: AXONETIS Server Foundation Ready
description: Hetzner server files verified ready Jun 2026 — bridge layer, AI gateway, 3 Supabase clients. Lovable must NOT duplicate any of these.
type: feature
---

# AXONETIS Server Foundation — VERIFIED READY (Jun 2026)

Founder confirmed `hostflow-server` repo (Hetzner) has all foundation files in place.
Domain: **aiaxonetis.nexatect.com** · Brand: **AXONETIS™**

## Files already on server — DO NOT recreate / duplicate

### Bridge Layer
- `bridge-orchestrator.ts`
- `agent-registry.ts`
- `realtime-sync.ts`
- `checksum-sync.ts` (5-min checksum reconciliation)
- `mirror-sync.ts` (7 mirror_ tables)

### AI Gateway
- OpenRouter Provider
- Groq Provider

### AI Models / Agents
- AI Jimmy (architect)
- AI Sherlock (auto-fix, max 3 loops)
- AI Advisors (8)
- AI Autonomous RapidPay

### Supabase Clients (server-side)
- `supabase1/client.ts` → HostFlow AI Operations
- `supabase2/client.ts` → AI Autonomous RapidPay
- `supabase3/client.ts` → AXONETIS Builder

## Hard rules (LOCKED)
1. **Never** redesign this architecture from Lovable.
2. **Never** create a duplicate bridge system on the Lovable side.
3. **Never** create a duplicate AI gateway / provider layer.
4. Lovable = Builder **frontend only**. Server logic stays in `hostflow-server` repo (founder manual).
5. Next milestone: **Phase 1 SQL foundation** — must align 1:1 with this server structure (bridge tables, mirror_ tables, ai_model_registry, project_files truth table, 8 Builder tables in Supabase 3).
