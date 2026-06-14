---
name: Phase 8 — Founder Command Center
description: Single unified Command panel aggregating pipeline + agent + cost + per-project health across all 3 products. Frontend-only, zero duplicate primitives.
type: feature
---

# Phase 8 — Deployment & Founder Command Center

## Files added (NO duplicates of existing primitives)
- `src/components/builder/panels/CommandCenterPanel.tsx` — unified aggregator (Pipeline · Health · Agents · Cost) across HostFlow / Rapid Pay / AXONETIS.
- Rail item `command` (Compass icon) added to RIGHT_RAIL_ITEMS + BottomTabId union + SidePanelDrawer switch.

## Reuses (no rebuilds)
- `getPreviewSession()` from `preview-engine.ts` (Phase 5) for sandbox/production status
- `listActivity()` from `hostflow-api.ts` (Phase 3) for Jimmy/Sherlock/error counts + cost+tokens
- `supabaseLabelFor()` from `project-workspace.ts` (Phase 7) for per-project Supabase routing label
- `PROJECTS` registry (Phase 1) — driver for cross-product loop
- `PublishModal` (Phase 7) triggered via `axonetis:publish` CustomEvent → TopBar listener

## No new server endpoints
All data comes from already-mounted bridge routes:
- `GET /api/preview/session?projectId&env`
- `GET /api/agents/activity?projectId&limit`
- `POST /api/preview/promote` (via PublishModal)

## Killer features status (per founder lock)
- Sherlock auto-fix loop (max 3) → already in `project-workspace.fixLoopIteration` (Phase 7) + UnifiedChat chip
- Diff preview/approve, time-travel rrweb, visual edit, voice deploy, agent marketplace, SQL-vector memory → DEFERRED to post-MVP per founder's "AXONET Advantage Layer" note
- Cost meter + telemetry → live in Command Center grid (ecosystem totals + per-project)
- Multi-agent swarm / DAG orchestrator → existing DualBrainPanel + activity stream (server-side already DAG-aware)

## Hard rules respected
- No new tables, no new routes, no duplicate panels (DeployPanel, AnalyticsPanel, ActivityFeedPanel stay untouched).
- Frontend-only delivery — server is locked.
