---
name: Phase 3.10.9 — agents.routes v2, 12/12 tools LOCKED
description: Phase 3.10.9 closed on old-gen stack (Bun + AI SDK + Express /rpc + SSE, NO tRPC/WebTransport). Full 12-tool server registry in server-snippets/agents.tools.ts, wired into agents.worker.ts with stopWhen stepCountIs(50). Approval tools = run_sql + deploy. Sub-agent cap 5.
type: feature
---

# Phase 3.10.9 — agents.routes v2 (12/12 tools) LOCKED

## Tech decision (LOCKED — do not re-open)
3.10.x = FROZEN old-gen per `constraints/additive-only-tech-policy-LOCKED`.
3.10.9 finishes an existing phase → **Bun + TypeScript + AI SDK + Express `/rpc` + SSE + Supabase 3 Realtime**.
tRPC + WebTransport start at **Phase 3.11 only**, on new files/new mount paths. Zero migration of frozen phases.

## Files
- `server-snippets/agents.tools.ts` — NEW, the only place tools are defined (no duplicates anywhere).
- `server-snippets/agents.worker.ts` — EXTENDED: `buildAgentTools()` + `stopWhen: stepCountIs(50)`.
- Copy target (verified path): `/opt/hostflow-ecosystem/hostflow-server/src/routes/agents.tools.ts`.

## 12 tools (LOCKED order)
1 write_file · 2 read_file · 3 line_replace · 4 grep · 5 run_sql (needsApproval) · 6 lsp_lookup
7 run_tests · 8 screenshot_preview · 9 fetch_url · 10 git_commit · 11 deploy (needsApproval) · 12 spawn_subagent (max 5)

## Hard rules
- Every tool call writes `tool_call_registry` (running → ok/error/aborted) → Realtime → ToolCallBubble.
- `run_sql` + `deploy` = `needsApproval: true`. Never auto-run.
- File tools: path traversal blocked, disk write + `project_files` mirror in the same call.
- `fetch_url`: loopback/private ranges blocked (SSRF guard).
- `spawn_subagent` never exceeds 5 live (`agent_subagents` status queued/running).
- Models NEVER hardcoded in the worker — `agent_registry.routing_config` is source of truth.

## Env needed on bridge
SUPABASE3_URL, SUPABASE3_SERVICE_ROLE_KEY, PROJECTS_ROOT, DATABASE_URL, PREVIEW_BASE_URL, BRIDGE_SELF_URL.

## Remaining for Phase 3.10 = 100%
- 3.10.8 LSP inline diagnostics UI (squiggles + hover + auto-fix + Problems badge) — `lsp_lookup` tool now supplies real data.
- 3.10.10 canonical migration: `mem_entries` (pgvector) + `agent_subagents`.
