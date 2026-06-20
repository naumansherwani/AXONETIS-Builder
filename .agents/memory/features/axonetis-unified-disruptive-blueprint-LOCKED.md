---
name: AXONETIS Unified Disruptive Blueprint LOCKED Jun 20 2026
description: THE single founder-locked unified blueprint for AXONETIS Builder. Hybrid arch (Browser ↔ Hetzner ↔ Supabase ×3), full agent hierarchy, model map, cinematic design system, build order (3.9 → 3.10 → 11 → 9 → 10 → 12), 12-tool registry, full phase-by-phase UI spec, tables summary, /rpc/ endpoint catalog, hardcoded limits, constitutional principles. Supersedes all earlier UI/phase blueprints on conflict.
type: feature
---

# AXONETIS™ AI Builder — UNIFIED DISRUPTIVE BLUEPRINT (FOUNDER-ONLY)

**Status:** LOCKED Jun 20 2026. Supersedes all prior UI/phase blueprints on conflict (master 9-phase blueprint still governs phase ordering & DB foundation).

**Company:** NEXATECT™ — Next Generation Autonomous Technology Execution Core & Treasury

**Ecosystem:**
- AANRIS™ — Artificial Intelligence Autonomous Neural Runtime Intelligent System
- AXOMAIL™ — Autonomous Xcentric Orchestration Mail — aiaxomail.com
- ANEXVOT™ AI Pay — Autonomous Next Generation Velocity Orchestration Treasury — anexvotaipay.com
- AXONETIS™ Builder — Autonomous Xclusive Orchestration Network Enterprise Technology Intelligent Sovereign — axonetis.com

---

## 0. Architecture — Hybrid System

```
[Browser: AXONETIS Builder UI] ←→ [Hetzner: hostflowai-server] ←→ [Supabase ×3]
        (Lovable repo)              (Bun + TypeScript + AI SDK)
                                            ↑
                              [Preview: iframe postMessage bridge]
```

**Hybrid Rules:**
- Frontend NEVER calls OpenRouter/Groq/AI providers directly.
- Frontend calls Hetzner REST + SSE only.
- Hetzner offline → graceful fallback ("Sovereign Runtime reconnecting…").
- All AI/build/deploy/file-ops via Hetzner.
- Realtime HMR via Supabase channel `project_files:{projectId}`.
- No service_role key in frontend. Ever.
- No AI provider SDKs in frontend. Ever.

**Supabase ×3:**
1. HostFlow Operations (business data)
2. ANEXVOT + CRM Mirror (treasury + sales data)
3. AXONETIS AI ka ghar (AI memory, tools, agents, builder data)

---

## 0.1 Agent Hierarchy

```
Founder (Nauman)
└── JIMMY (Commander, Autopilot CEO, brain+heart)
    ├── Sherlock (Deputy — audit, QA, compliance gatekeeper)
    ├── Rapid Pay AI Commander (treasury + revenue)
    ├── 8 Industry Advisors:
    │     Aria (Healthcare), Orion (Finance), Rex (Legal),
    │     Lyra (Creative), Sage (Education), Atlas (Logistics),
    │     Vega (Energy), Kai (Defense)
    └── Outreach Sub-Agents:
          Hunter → Qualifier → Writer → Sherlock gate → Sender → Reply Detector → Closer
```

---

## 0.2 Model Map (LOCKED — Never Change)

| Agent | OpenRouter Primary | Speed | Local Fallback |
|---|---|---|---|
| Jimmy | Hermes 3 405B · Qwen3 Coder 480B | Groq | qwen3:8b |
| Sherlock | DeepSeek R1 · Hermes 3 405B | Groq | qwen3:8b |
| 8 Advisors | GPT-OSS 120B · Llama 3.3 70B | Groq | qwen3:4b |
| Global Router | Llama 3.3 70B | Groq | — |

**Memory:** Jimmy 3M · Sherlock 1M · each Advisor 100k.

---

## 0.3 Cinematic Design System

**Colors:**
- Background `#0A0A0F` (matte black)
- Card `#12121A` (sovereign glass)
- AI Bubble `#12121A` + left border `#8B5CF6` (violet glow)
- User Bubble `#12121A` + left border `#00D4AA` (electric emerald)
- Tool Call `#1A1A2E` + pulse
- Error `#EF4444` + shake
- Success `#10B981` + glow + particle burst
- Warning `#F59E0B`
- Text Primary `#FFFFFF` / Secondary `#94A3B8`
- Code `#1E1E2E` + `#00D4AA` syntax
- Shimmer `linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)`

**Typography:** Inter 700/48 H1 · 600/32 H2 · 600/20 H3 · 400/16 body · JetBrains Mono 14 code · Inter 400/12 small.

**Animations:** AI typing 3-dot bounce 600ms · new message slide-up 240ms + fade · tool exec border pulse 120ms · deploy success particle burst + glow · error shake 300ms · shimmer sweep 2s ∞ · treasury gradient sweep · cursor pulse 1.5s ∞.

**Glassmorphism:** `backdrop-filter: blur(12px); background: rgba(18,18,26,0.8); border: 1px solid rgba(255,255,255,0.06)`.

---

## 0.4 Build Order (LOCKED)

`Phase 3.9 → 3.10 → 11 → 9 → 10 → 12`

---

## Phase 3.9 — Real Builder Parity

Cinematic chatbox (header + AI/user/tool bubbles + composer with voice/@mention/slash/attach/deploy), sidebar panels (Files, Cloud[DB/Storage/Secrets], Domains, Versions, Tools, Costs, Security, Logs, Analytics), Publish modal, power tools (run_sql + Caddy + time-travel + rrweb), composer polish (Stop, Visual Edit, Diff Review, shimmer), post-MVP (Agent marketplace, voice deploy), cost meter + Global Router UI, SQL migration `2026_06_13_phase3_9_builder_parity.sql`.

**Keyboard:** ⌘↵ send · ⌘K palette · ⌘⇧D deploy · ⌘/ focus · ⌘B sidebar · Esc cancel · ↑ edit last.

---

## Phase 3.10 — Real Agent Loop

AI SDK `streamText + tool() + stopWhen: stepCountIs(50)` on Hetzner.

**12 Tools (locked):** write_file, read_file, line_replace, grep, run_sql (needsApproval), lsp_lookup, run_tests, screenshot_preview, fetch_url, git_commit, deploy (needsApproval), spawn_subagent (max 5).

Every tool call → `tool_calls` row → SSE to UI. Sub-phases: registry+zod, activity stream UI, diff approval modal, cost meter in StatusBar, sub-agent timeline (DualBrainPanel), mem:// editor, self-verify loop UI (3 attempts), LSP inline diagnostics, server snippet `agents.routes.ts v2`, migration adds `tool_calls`, `agent_subagents`, `mem_entries`.

---

## Phase 11 — Outreach Engine ($1M ARR Autopilot)

Lovable builds dashboard only; Jimmy self-commits on Hetzner.
- Pipeline Kanban (Scraped→Qualified→Contacted→Replied→Demo→Closed) + ARR counter.
- Daily standup chat (Roman Urdu) + stat cards + action buttons.
- Compliance badge: GDPR, spam <3 green, unsubscribe ✅, Sherlock stamp.

---

## Phase 9 — Trojan Horse CRM Connect

Connect existing Enterprise CRM. NO new CRM built. Lives in Founder OS sidebar.
- Connectors: Salesforce / HubSpot / Zoho OAuth.
- Data mirror sync dashboard.
- AI superpowers: auto-reply (approval queue), dedupe merge, lead score (Aria), voice command, NL→SQL bulk action, sentiment timeline, forecast.
- Kill switch: SF logins counter, Jimmy CRM counter, savings display, disconnect button.

---

## Phase 10 — Advantage Layer (Top-5 World)

16 features: rrweb replay, Sherlock replay analyzer, voice composer (hold-to-record + waveform), screenshot vision (drop zone + element map), multiplayer presence (cursors + activity feed via `presence:project:{id}`), AI test generator (coverage ring), cost-aware router UI, browser-use agent (Playwright + Sherlock supervision), skill marketplace (30% creator rev share), one-prompt full-stack (20-task swarm, 5 workers), auto-migration runner (dry-run + diff + rollback), industry advisor router (@mention), founder sandbox (env toggle + RESET confirm), explainability layer ("Why" tooltip + decision chain), command center (CPU/RAM/AI load/cost/revenue real-time SSE).

---

## Phase 12 — Final Lock

Settings panel (model prefs, memory slider, cost thresholds, notifications, theme), onboarding (Connect CRM → Invite → First project → Jimmy tutorial), help center (search + categories + articles + video + contact).

---

## Tables Summary

**Supabase 3 (AXONETIS AI ka ghar):** projects, files, file_versions, commits, deployments, project_publish, share_links, domains, dns_records, caddy_sites, project_domains, project_attachments, migration_history, session_replays, visitor_events, marketplace_agents, installed_agents, ai_costs, tool_calls, agent_subagents, mem_entries, skills, skill_installs, skill_payouts, presence_events, project_envs.

**Supabase 2 (ANEXVOT + CRM Mirror):** crm_connections, crm_mirror_log, sf_mirror_accounts/contacts/leads/opportunities/cases, sync_log, outreach_companies, outreach_signals, outreach_contacts, outreach_icp_scores, outreach_campaigns, outreach_messages, outreach_meetings, outreach_deals.

**Supabase 1 (HostFlow Operations):** existing business tables (untouched by AXONETIS).

**Rule:** every table = GRANT + RLS + policy in SAME migration file.

---

## Endpoints (All `/rpc/*` — NOT `/api/`)

`voice.transcribe`, `vision.analyze`, `browser.use`, `files.list/read/write`, `versions.list/restore`, `deploys.create/status(SSE)`, `domains.list/verify`, `caddy.activate`, `replay.events/get`, `costs.get`, `presence.update`, `skills.list/install`, `cloud.sql.run`, `cloud.analytics`, `cloud.logs.stream(SSE)`, `cloud.security.scan`, `cloud.backups.list`, `cloud.backup.create`, `crm.connect/sync.status/sync.trigger/disconnect`, `outreach.pipeline/standup/compliance`.

---

## Hardcoded Limits (Never Change)

`stepCountIs(50)` min agent steps · 3 self-verify loops · 10K files attach · 5M chars attach · 7-day share expiry · 25 emails/hr drip · spam <3 max · 5 parallel workers one-prompt swarm · Jimmy 3M / Sherlock 1M / advisor 100k memory.

---

## Constitutional Principles

Jimmy builds. Sherlock audits. Founder reviews. Lovable implements.
- No revenue talk in code. No business logic in UI.
- Clean phases. No duplicates. No dummy buttons (every control = real endpoint or "Server endpoint pending").
- No service_role key in frontend. No AI provider SDKs in frontend.
- AI Elements first for chat surface.
- Every endpoint authenticated; admin endpoints `has_role` checked.
- Every table: GRANT + RLS + policy same migration.
- Realtime HMR over full reload.
- Diff preview before any AI-applied change.
- `stepCountIs(50)` minimum for agent loops.
- `mem://` auto-injected in system prompt, never user message.
- Lovable repo never holds CRM/outreach code — Jimmy self-commits on Hetzner.
- GitHub token only in founder account — never in Lovable repo.
- Frontend NEVER calls OpenRouter/Groq directly.
- Shimmer on every AI message. Glass on all cards.
- Founder-only: no public signup, no team plans, no billing UI.
