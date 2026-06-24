---
name: AXONETIS Master Blueprint FINAL LOCKED (Founder Lock Version)
description: THE definitive 9-phase locked blueprint for AXONETIS Builder + full Rapid Pay AI hierarchy. Supersedes all prior blueprints. Phase 1 SQL done & verified Jun 2026. Phase-by-phase + git pull workflow LOCKED.
type: feature
---

# AXONETIS — FINAL IMPLEMENTATION BLUEPRINT (Founder Lock Version)

**Status:** LOCKED. Supersedes all earlier builder blueprints in memory.
**Domain:** aiaxonetis.nexatect.com · Private founder-only.
**Phase 1 SQL:** ✅ RUN & VERIFIED on Hetzner Supabase 3 (Jun 12 2026) — 11 ai_agent_identities, user_roles seeded, all 8 core + 7 mirror tables live.

## Workflow rule (LOCKED — never break)
1. Lovable builds **ONE phase** frontend only.
2. Founder says **ruko** → reviews → `git pull` on Hetzner if server-side.
3. Founder says **agla phase** → next phase begins.
4. **NEVER** skip ahead. **NEVER** touch `hostflow-server` repo.
5. **NEVER** rebuild existing HostFlow / Rapid Pay / Resolution Hub / AANRIS backends.
6. **NO** Docker, **NO** Replit, **NO** OpenHands, **NO** Lovable runtime sandbox.

## Project objective
Private founder OS to build & manage HostFlow AI, Rapid Pay, and future products. AI engineering + coding + preview + deployment + project management — all in one workspace.

## Supabase architecture (LOCKED)
- **Supabase 1** → HostFlow Operations (exists)
- **Supabase 2** → Rapid Pay (exists)
- **Supabase 3** → AXONETIS Builder (truth — projects, files, versions, chats, agents, deployments, preview state)

## 9 Phases (LOCKED order)

### Phase 1 — Builder Foundation ✅ DONE
Auth, founder access, project registry, workspace registry, settings. Tables: projects, workspaces, builder_settings, builder_users (covered by current Phase 1 SQL: projects, project_files, ai_agent_identities, ai_model_registry, user_roles, etc.).

### Phase 2 — Founder Workspace
Top nav · Left project controls · Center live sandbox preview · Bottom unified AI chat · Right tabs (Files/Logs/DB/Deploy/Agents). Resizable, dark, command palette, activity feed, Monaco, project nav, agent monitor.

### Phase 3 — AI Orchestration Layer
OpenRouter + Groq wired. Activate Jimmy, Sherlock, 8 Advisors, Rapid Pay agents. Tables: agent_registry, agent_memory, agent_activity, agent_threads.

### Phase 4 — Jimmy & Sherlock System
Dual-brain engineering workflow (see AI model map below).

### Phase 5 — Custom HostFlow Preview Engine
Replaces Docker. Live preview + hot reload via Supabase Realtime. AI → code → Supabase → preview engine → instant refresh. Sandbox-first, never edit production directly.

### Phase 6 — Version Control & Recovery
Snapshots, diff history, rollback, restore, version timeline. Tables: file_versions, deployments, rollback_history.

### Phase 7 — Multi-Project Builder
One workspace controls HostFlow / Rapid Pay / future. Project switching, isolation, independent workspaces/history/preview.

### Phase 8 — Deployment & Founder Command Center
Sandbox/Staging/Production pipeline. Analytics, health, agent monitoring, Jimmy/Sherlock activity, project + deployment + preview health.

### Phase 9 — AXONET Advantage Layer (post-MVP only after 1–8 ship)
1. Multi-agent swarm parallel (Jimmy + Sherlock + 8 advisors w/ conflict resolution)
2. DAG orchestrator (dependency-aware task graph)
3. Sherlock auto-fix loop (max 3 retries)
4. Diff preview + approve/reject UI
5. Time-travel replay (rrweb)
6. Visual edit mode (click element → AI edits source)
7. Cost meter + telemetry dashboard (per-call OpenRouter/Groq)
8. Voice deploy / voice commands
9. Agent marketplace (pluggable advisors)
10. SQL-native vector memory + semantic recall
11. Cross-product context bridge intelligence (read 7 mirror_ tables)

## AI Model Assignments (LOCKED)

### Builder side
**Jimmy** — Reasoning: Hermes 405B · Primary coding: Qwen3 Coder 480B · Fallback coding: Qwen3 Next 80B · Mission: world-class cinematic UI/UX, product design, architecture
**Sherlock** — Infra intel: DeepSeek R1 · Resolution intel: GPT-OSS 120B · Mission: verification, debug, security, RCA, production safety
**8 Industry Advisors** (Aria, Orion, Rex, Lyra, Sage, Atlas, Vega, Kai) — GPT-OSS 120B
**Global Router** — Llama 3.3 70B (routing, function calling, tool/agent selection)

### Rapid Pay AI hierarchy (FINAL)
**Supreme Layer**
- AI Jimmy™ — Reason Hermes 405B / Code Qwen3 Coder 480B / Fallback Qwen3 Next 80B
- AI Sherlock™ — Primary auditor DeepSeek R1 / Deep investigation Hermes 405B / Structured verify GPT-OSS 120B

**Treasury Civilization Layer**
- AI Ledger Fox™ — GPT-OSS 120B
- Recovery Phantom™, AI Treasury Sentinel™, AI Corridor Brain™, AI Treasury Navigator™, AI Runtime Echo™, AI Replay Keeper™, AI Settlement Hawk™, AI Fraud Radar™ — all Llama 3.3 70B
- Escalation → DeepSeek R1

**Intelligence Layer**
- AI Treasury Stress Intelligence™ — Hermes 405B
- AI Revenue Brain™ — GPT-OSS 120B
- AI Explainability Civilization™ — GPT-OSS 120B
- Founder Sandbox Civilization™ — Hermes 405B

**AI Global Routing Layer** — Llama 3.3 70B

## Frontend stack (LOCKED)
React · Vite · TypeScript · Tailwind · Monaco · Framer Motion

## Backend stack (LOCKED)
Existing HostFlow backend on Hetzner. No rebuild, no replacement, no duplicate runtime.

## Success criteria (must all be true at v1)
Founder chats with AI · Jimmy plans + generates code · Sherlock verifies + debugs · AI edits projects · preview updates instantly · multi-project mgmt · version history + rollback · deploy pipeline · command center · HostFlow/RapidPay/future all manageable · zero Docker/Replit/OpenHands · existing backends untouched.
