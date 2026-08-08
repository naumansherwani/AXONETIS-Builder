---
name: Phase 11.1 Pipeline Dashboard LOCKED
description: Phase 11.1 Outreach Engine — outreach_leads table on Supabase 3, PipelinePanel kanban (6 stages, drag-drop, lead modal, live ARR counter), workspace tab "pipeline" + right-rail item.
type: feature
---

# Phase 11.1 — Pipeline Dashboard (LOCKED)

- Frontend only (Jimmy scrapes/sends on Hetzner engine; no dummy rows).
- `src/lib/outreach-api.ts` — single API: fetchPipeline, moveLead, subscribePipeline (Realtime),
  computeArr (closed MRR × 12), computeWeightedArr (stage probability), groupByStage, formatUsd.
- `src/components/builder/panels/PipelinePanel.tsx` — 6-column kanban
  Scraped → Qualified → Contacted → Replied → Demo → Closed, HTML5 drag-drop (optimistic +
  rollback), per-column count, lead detail modal, ARR counter with $1M progress bar.
- Registered ONCE: `tab-registry.tsx` kind `pipeline`, `rail-items.ts` right rail `pipeline`,
  `SidePanelDrawer` → PipelineRailPanel "Open in Workspace", `BottomTabId` extended.
- Table: `public.outreach_leads` (stage enum-checked text, mrr_value numeric, score, owner_agent,
  last_touch_at, notes) — RLS read for authenticated, service_role all, Realtime publication.
