# AXONETIS — Database migrations

Self-hosted Supabase (Hetzner). **Never run on Lovable Cloud.**

## How to apply

```bash
# on Hetzner box, against the AXONETIS Supabase Postgres
psql "$AXONETIS_DB_URL" -f db/migrations/2026_06_12_phase3_agents.sql
```

## Phase 3 — AI Orchestration Layer

File: `migrations/2026_06_12_phase3_agents.sql`

Creates:
- `agent_registry` — catalog of all agents (Jimmy, Sherlock, 8 advisors, Router)
- `agent_threads` + `agent_thread_messages` — chat conversations
- `agent_memory` — long-term memory (pgvector-ready)
- `agent_activity` — append-only event log for Activity Feed

Seeds 11 agents. RLS enabled, grants set for `authenticated` and `service_role`.

## What HostFlow server repo (`hostflowai-server`) must implement

After applying SQL, build these endpoints on Hetzner:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/agents` | GET | List `agent_registry` |
| `/api/agents/:slug/chat` | POST (stream) | Send message, stream agent reply, insert messages + activity |
| `/api/agents/sherlock/scan` | POST | Trigger code/RCA scan on a project |
| `/api/agents/threads` | GET | List threads (filter: project_id, agent_slug) |
| `/api/agents/threads/:id/messages` | GET | Load thread messages |
| `/api/agents/:slug/memory` | GET/POST | Read/write agent memory |
| `/api/agents/activity` | GET (SSE) | Live activity feed |
| `/api/agents/router/route` | POST | Route a task to best agent (uses Llama 3.3 70B) |

All endpoints call **OpenRouter / Groq** server-side using `OPENROUTER_API_KEY` + `GROQ_API_KEY`. Frontend never sees keys.
