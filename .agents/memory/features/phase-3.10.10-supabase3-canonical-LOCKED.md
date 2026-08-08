---
name: Phase 3.10.10 Supabase 3 canonical schema LOCKED
description: Phase 3.10.10 — tool_call_registry (canonical, + tool_calls view + tool_cost_daily), agent_subagents (5-live/depth-3 DB trigger), mem_entries pgvector(1536) with match/search/prune functions. Embedding model openai/text-embedding-3-small.
type: feature
---

# Phase 3.10.10 — Supabase 3 canonical migration (LOCKED)

File: `hetzner-migrations/20260811000000_phase_31010_supabase3_canonical.sql` (idempotent).

## tool_call_registry (canonical tool ledger — NO duplicate)
- Blueprint's `tool_calls` is a **VIEW** over it (`agent_id` = `agent_slug`, `created_at` = `started_at`).
  Never create a `tool_calls` table.
- Cost Meter (3.9.7) reads `tool_cost_daily` view (project/day: calls, tokens, cost).
- Written by `server-snippets/agents.tools.ts` logStart/logEnd: running → ok|error|aborted.

## agent_subagents
- Raw spawn_subagent execution record (parent_id, task, status, model, result, cost, depth).
- `agent_delegations` / `agent_delegation_tasks` remain the UI tree; agent_subagents is the ledger.
- DB trigger `enforce_subagent_limits`: max 5 live per thread, max depth 3 (swarm runaway guard) —
  same cap as MAX_SUBAGENTS in the tool.
- `spawn_subagent` now inserts a row → calls `/rpc/delegate.create` → stores `delegation_id`,
  marks `failed` on bridge error.

## mem_entries (pgvector)
- `vector(1536)` = **openai/text-embedding-3-small** via Lovable/OpenRouter embeddings; `model_version`
  column so a model swap = re-embed, not schema break. hnsw `vector_cosine_ops` (direct, no halfvec — 1536 ≤ 2000).
- Dedupe: unique index on (agent_id, project_id, md5(content)) via generated `content_hash`.
- Functions: `match_mem_entries(query_embedding, agent, project, count, min_similarity)` (semantic),
  `search_mem_entries(q, agent, count)` (trigram fallback), `prune_mem_entries(days)` (decay GC for
  unpinned / importance<0.35 / unused, plus expired rows).
- `agent_memory` (Phase 3 base) stays for short-term scoped memory; mem_entries is long-term vector memory.

## Rules
- pgvector + pg_trgm extensions created by this migration.
- Realtime publication added for all three tables.
- Old-gen stack (Express /rpc + Supabase 3 Realtime) — additive-only policy respected.
