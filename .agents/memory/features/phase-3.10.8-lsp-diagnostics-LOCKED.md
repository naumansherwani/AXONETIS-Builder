---
name: Phase 3.10.8 LSP inline diagnostics LOCKED
description: Phase 3.10.8 shipped — project_diagnostics table (Supabase 3), bridge /rpc/lsp.diagnostics + /rpc/lsp.autofix, CodePanel wavy squiggles + hover card + Jimmy Fix button, Problems badge in CodePanel header and StatusBar. Old-gen stack (Express /rpc).
type: feature
---

# Phase 3.10.8 — LSP inline diagnostics (LOCKED)

## Frontend (single source, no duplicates)
- `src/lib/lsp-api.ts` — fetchDiagnostics (Supabase 3), runDiagnosticsScan, requestAutoFix,
  subscribeDiagnostics (Realtime), diagnosticsByLine helper.
- `src/hooks/useDiagnostics.ts` — the ONLY diagnostics hook; used by CodePanel + StatusBar.
- `CodePanel.tsx` (extended, not duplicated): wavy squiggles (red error / amber warning),
  gutter tint, hover card with tsc message + `Fix` button, header Problems badge + Scan button,
  per-file problems list.
- `StatusBar.tsx` (extended): `Problems: NE / MW` badge, pulses while scanning.

## Backend
- `server-snippets/lsp.routes.ts` → bridge `src/routes/lsp.routes.ts`, mounted at `/rpc`.
  - `POST /rpc/lsp.diagnostics { projectId, path? }` — runs `bunx tsgo --noEmit` in
    `PROJECTS_ROOT/<slug>`, replaces the project's rows in `project_diagnostics`.
  - `POST /rpc/lsp.autofix { projectId, threadId?, diagnostic }` — inserts a real founder
    message on Jimmy's thread (agent worker fixes it). No client-side patching.
- SQL: `hetzner-migrations/20260809000000_phase_3108_lsp_diagnostics.sql` — `project_diagnostics`
  + grants + RLS read + realtime publication.
- Install doc: `server-snippets/INSTALL-phase-3108-lsp-diagnostics.md`.

## Rules
- 3.10.8 is a frozen-phase completion → old-gen stack (Express `/rpc` + Supabase 3 Realtime). No tRPC.
- `lsp_lookup` tool (3.10.9) and this route share the SAME parser contract — keep them identical.
- Zero dummy: badge shows only real tsc output; no diagnostics = "0 problems".

## Phase 3.10 remaining
- 3.10.10 canonical migration: `mem_entries` (pgvector) + `agent_subagents`.
