---
name: Phase 2 — Founder Workspace (frontend complete)
description: Phase 2 frontend shipped Jun 12 2026. Resizable preview/chat split, ambient cinematic glow shell, 9 bespoke side-drawer panels (Files/Code/Agents/Logs/Database/Deploy/Projects/Versions/Analytics) + GenericPanel fallback. No backend wiring yet — Hetzner bridge connects in Phase 3.
type: feature
---

## What shipped (Phase 2, frontend only)
- `BuilderShell` — ambient cinematic glow (red + violet radial washes, 44px grid overlay) wrapping the whole workspace.
- `VerticalSplit` — pointer-drag resizable splitter between LivePreview (top) and UnifiedChat (bottom). Ratio persisted in `localStorage` key `axonetis.center.split.v1`.
- `SidePanelDrawer` — now renders 9 bespoke panels by `bottomTab` id, falls back to `GenericPanel` for unwired tabs. Drawer width 340px.
- Panels under `src/components/builder/panels/`:
  - `FilesPanel` — collapsible file tree mirroring `project_files` shape
  - `AgentsPanel` — Supreme (Jimmy + Sherlock) + 8 industry advisors + Global Router, status dots + model badges
  - `LogsPanel` — streaming log feed (mock interval, ready for SSE/Realtime swap)
  - `DatabasePanel` — Hetzner Supabase 3 schema browser (8 core + 7 mirror tables, matches Phase 1 SQL)
  - `DeployPanel` — Sandbox → Staging → Production pipeline with animated active stage + recent deploys
  - `ProjectsPanel` — switch between HostFlow / Rapid Pay / AXONETIS
  - `CodePanel` — read-only code viewer with line numbers (Monaco lands later)
  - `VersionsPanel` — time-travel snapshot list with rollback affordance
  - `AnalyticsPanel` — cost + token + latency metrics, provider status
  - `PanelChrome` — shared `PanelSection` / `Row` / `Dot` primitives for consistent dark-glass styling

## What did NOT change (LOCKED)
- TopBar — cinematic glow, brand block, all sizes preserved.
- AxonMark logo, agent state machine.
- Authentication / lock gate / supabase3 client.
- Phase 1 SQL on Hetzner.
- No new npm dependencies installed (no Monaco, no resizable-panels — both lightweight in-house).

## Phase 3 entry points (NOT done yet — wait for founder "agla phase")
- Wire `LogsPanel` to Hetzner SSE bridge.
- Wire `FilesPanel` to `project_files` via Supabase Realtime.
- Wire `AgentsPanel` to `ai_agent_identities` live status updates.
- Activate OpenRouter + Groq for Jimmy & Sherlock through global router (Llama 3.3 70B).
