---
name: Server Endpoint Copy-Paste Workflow LOCKED
description: Founder workflow rule: for backend endpoint wiring, provide exact TypeScript server code blocks for founder to copy and run manually; do not modify server repo.
type: preference
---

# AXONETIS Founder Lock — Server Endpoint Copy-Paste Workflow

From now on, when backend endpoint wiring is needed for `hostflowai-server`, Lovable must:

1. **Write exact TypeScript endpoint code** for the founder to copy into his server repo.
2. Keep it **terminal/copy-paste ready** when possible.
3. Include the **exact route path, method, request body, query params, and response JSON shape**.
4. Match the frontend contract in `src/lib/hostflow-api.ts` unless founder changes it.
5. Never touch or assume direct access to `hostflowai-server`.
6. Never run server SQL or server commands unless founder explicitly confirms server is ready.
7. Do not give vague architecture only — give implementation code that founder can paste and run.

Reason: Founder has been stuck on Phase 3 endpoint confusion; endpoint contract clarity and copy-paste TypeScript is now mandatory.

## Phase 3 API Contract LOCKED — Frontend 1:1

For Phase 3 AXONETIS agent endpoints, the frontend expects raw JSON shapes only:

| Endpoint | Response shape |
| --- | --- |
| `GET /api/agents` | `AgentInfo[]` raw array |
| `POST /api/agents/:slug/chat` | `{ threadId, messageId, status: "queued" }` |
| `POST /api/agents/sherlock/scan` | `{ scanId, status: "queued" }` |
| `GET /api/agents/threads` | `AgentThread[]` raw array |
| `GET /api/agents/threads/:id/messages` | `AgentMessage[]` raw array |
| `GET /api/agents/:slug/memory` | `AgentMemoryRow[]` raw array |
| `POST /api/agents/:slug/memory` | `{ id }` |
| `GET /api/agents/activity` | `AgentActivity[]` raw array |
| `GET /api/agents/activity/stream` | SSE `data: <json>\n\n` + heartbeat |
| `POST /api/agents/router/route` | `{ agent, reason, estimatedCost }` |

Absolute rule: **NO `{ success: true, data: [...] }` wrapper anywhere** for Phase 3 agent API responses. If a route returns a list, return the raw array directly. Chat returns only the queued ack object above.

Model routing rule: **zero hardcoded TypeScript model routing**. Runtime model routing must read `agent_registry.routing_config` from Supabase 3 / founder's third backend database. Required server env vars: `SUPABASE3_URL`, `SUPABASE3_SERVICE_ROLE_KEY`. Do not touch Rapid Pay AI routing for this phase. Chat worker enqueue can remain a commented integration point unless founder asks to wire the existing OpenRouter → Groq → Ollama chain.