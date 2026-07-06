---
name: AXONETIS Phase Order + Audit LOCKED Jul 6 2026
description: Founder-locked implementation sequence for AXONETIS Builder AND live audit of what's done / what's pending. Order is FIXED — no reordering, no skipping. ANEXVOT AI Pay is deferred until AXONETIS complete.
type: feature
---

# AXONETIS Implementation Order (LOCKED)

**Rule:** Complete AXONETIS FIRST. ANEXVOT AI Pay is deferred (very end).

## Sequence (do not reorder)
1. **Phase 3.9.1** — Chatbox (Unified Cinematic Chat: header, AI/user/tool bubbles, composer with voice/@mention/slash/attach/deploy, shimmer, diff review)
2. **Phase 3.9.2** — Sidebar (Files, Cloud[DB/Storage/Secrets], Tools, Costs, Security, Logs, Analytics panels)
3. **Phase 3.9.3** — Domains (default URL, custom domain, DNS table, Caddy SSL, primary toggle)
4. **Phase 3.9.4** — Versions (commit list, branch selector, Monaco diff, restore, Sherlock badge)
5. **Phase 3.10** — Tool Registry (12 tools + Zod + permission matrix + activity stream UI + diff approval modal + cost meter + sub-agent timeline + mem editor + self-verify loop + LSP inline)
6. **Phase 3.10.9** — Agents Runtime (agents.routes.ts v2 on Hetzner: streamText + tool() + stopWhen: stepCountIs(50) + SSE)
7. **Phase 3.10.10** — Supabase 3 Tables (tool_calls, agent_subagents, mem_entries — GRANT + RLS + policy same migration)

**Only after 3.10.10 complete:**
8. Phase 9 — Trojan Horse CRM (inside Founder OS)
9. Phase 10 — Advantage Layer (16 top-5 features)
10. Phase 11 — Outreach Engine

Phase 12 (Final Lock: Settings + Onboarding + Help) closes AXONETIS.

**Then and only then:** ANEXVOT AI Pay (Supabase 2, Polar checkout already wired — future work).

---

# Live Audit — Jul 6 2026

## Done ✅
- **Phase 3 backend foundation:** agent_registry + routing_config seeded (Jimmy/Sherlock/8 advisors/Router) — `db/migrations/2026_06_12_phase3_agents.sql` + `2026_06_13_phase3_routing_config.sql`
- **Phase 4 (dual brain idempotent), Phase 5 (preview engine), Phase 6 (versions):** migrations shipped
- **BuilderShell + layout skeleton:** TopBar, SideRail, SidePanelDrawer, HorizontalSplit, VerticalSplit, StatusBar, LivePreview, CommandPalette, PublishModal
- **UnifiedChat.tsx (545 LOC):** exists — chat surface, Jimmy+Sherlock scope enforced
- **16 side panels exist:** Activity, Agents, Analytics, Code, CommandCenter, Database, Deploy, DualBrain, Files, Generic, Logs, Memory, Panel chrome, Projects, Runtime, Versions
- **Model lock:** Jimmy/Sherlock 6-model routing (J1-J3 Hermes/Qwen3-Coder/Qwen3-Next, S1-S3 DeepSeek-R1/Hermes/GPT-OSS 120B) — founder confirmed
- **Hetzner Rust runtime:** main.rs live with 3-key OpenRouter routing
- **Preview iframe bridge, project_files realtime HMR:** wired

## In progress / partial ⚠️
- **Phase 3.9.1 Chatbox:** UnifiedChat exists but needs cinematic polish (shimmer sweep on new msg, diff-preview inline card, tool-call embedded mini-card w/ progress+cost, voice waveform, @mention picker, /slash palette, stop button, visual-edit-mode hook, cost meter in header)
- **Phase 3.9.2 Sidebar:** panels exist as stubs — most are placeholder chrome; need real wiring to `/rpc/*` endpoints
- **Server Rust:** Smart Hybrid routing (OR1-first + 80% quota → OR2 warm backup + public users OR1-blocked) NOT YET applied; Sherlock manual-mode (no auto-fire after Jimmy) NOT YET applied

## Pending ❌ (in order)
- **3.9.1** — Chatbox cinematic polish + full spec parity
- **3.9.2** — Sidebar real wiring (Files, Cloud tabs, Tools, Costs, Security, Logs, Analytics)
- **3.9.3** — Domains panel (DNS table, Caddy activate, primary toggle)
- **3.9.4** — Versions panel real wiring (Monaco diff, restore, Sherlock badge)
- **3.10** — 12-tool registry with Zod + permission matrix + activity stream + diff modal + cost meter + sub-agent timeline + mem editor + self-verify UI + LSP inline
- **3.10.9** — Hetzner `agents.routes.ts v2` (streamText + 12 tool() defs + stopWhen(50) + SSE per tool)
- **3.10.10** — Supabase 3 migration: `tool_calls`, `agent_subagents`, `mem_entries` (pgvector) with GRANT + RLS + policy
- **Phase 9** — Trojan Horse CRM (blocked)
- **Phase 10** — Advantage Layer 16 features (blocked)
- **Phase 11** — Outreach Engine (blocked)
- **Phase 12** — Settings + Onboarding + Help (blocked)

## Rough completion
~35% of AXONETIS. Backend foundation solid, UI skeleton done, real wiring + Phase 3.10 agent loop remaining before Phase 9/10/11 unlock.

## Enforcement
Any request to skip ahead to Phase 9/10/11 while 3.9.x or 3.10.x incomplete → reject. Any request to start ANEXVOT AI Pay before Phase 12 → reject. Reference this file.
