---
name: Phase 7 — Multi-Project Builder
description: Project isolation (HostFlow / Rapid Pay / AXONETIS / future), independent workspace + chat history + preview env per project, Supabase 1/2/3 routing, 1-click Publish (sandbox→production via /api/preview/promote), Sherlock 3-fix-loop chip in chat header.
type: feature
---

# Phase 7 — Multi-Project Builder (frontend)

Goal: one Builder shell runs N products. Each product = isolated workspace.

## Isolation contract (per project)
- Chat history (UnifiedChat messages, persisted via `loadWorkspace/patchWorkspace`)
- branch, environment, previewEnv
- Sherlock auto-fix iteration counter (0..3)
- Preview session (already env+project keyed in `preview_sessions`)
- Supabase routing: hostflowai → SB1, rapidpay → SB2, founderbuilder → SB3
  (server enforces; frontend label only via `supabaseLabelFor`)

## Storage
- `axonetis.phase7.workspaces.v1` → `Record<ProjectId, ProjectWorkspace>`
- `axonetis.phase7.activeProject.v1` → last selected project

## Key files
- `src/lib/project-workspace.ts` — load/save/patch + supabase label
- `src/components/builder/BuilderShell.tsx` — hydrates per-project state on switch
- `src/components/builder/UnifiedChat.tsx` — per-project messages + fix-loop chip + 10k files chip
- `src/components/builder/PublishModal.tsx` — Sherlock audit beat → promote sandbox→production
- `src/components/builder/TopBar.tsx` — Publish button wires modal, project menu shows SB label

## Visual
- Continuous gradient ribbon across chat+preview top in BuilderShell `<main>`
  (fixes the corner gap visible in founder's screenshot comparison)
- LivePreview toolbar h-9 → h-14 to match UnifiedChat header height
