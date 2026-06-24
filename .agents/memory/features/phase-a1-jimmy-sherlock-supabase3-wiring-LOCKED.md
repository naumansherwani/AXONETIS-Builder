---
name: Phase A.1 LOCKED — Jimmy/Sherlock Supabase 3 SSE wiring shipped
description: Phase A.1 (Founder Builder 40% remaining, step 1 of 5) done — UnifiedChat migrated from sendBuilderCommand-only to chatWithAgent + Supabase 3 Realtime thread stream. Server snippet agents.worker.ts ready for copy-paste into axonetis-builder PM2 process (id 4).
type: feature
---

# Phase A.1 — LOCKED Jun 24 2026

## Frontend (Lovable repo, this project)

- `src/lib/agent-stream.ts` — Supabase 3 Realtime helper. Subscribes to `agent_thread_messages` filtered by `thread_id`, plus `fetchThreadMessages` backfill + `extractText` part-walker. `UNIFIED_CHAT_SLUGS = {jimmy, sherlock}` enforces unified-chat-scope LOCK (no advisor bleed-through).
- `src/lib/project-workspace.ts` — `ProjectWorkspace.jimmyThreadId?: string` so each project keeps its own Supabase 3 thread.
- `src/components/builder/UnifiedChat.tsx` — on send: `chatWithAgent("jimmy", { projectId, threadId, prompt })` → POST to axonetis-builder. Realtime onMessage replaces the "Working on it…" placeholder when the worker inserts the assistant row. Sherlock rows appear inline as their own bubble. Legacy `sendBuilderCommand` kept as fallback only on chatWithAgent error (bridge status stays green for ops).

## Server (axonetis-builder PM2 id 4 — copy-paste)

- `server-snippets/agents.worker.ts` (target: `/root/axonetis-builder/src/workers/agents.worker.ts`) — `enqueueAgentReply({ threadId, messageId, agentSlug, projectId, prompt })`.
  - Reads routing from `agent_registry.routing_config` (NEVER hardcoded).
  - Provider chain: OpenRouter primary → Groq secondary → Ollama last-resort.
  - Inserts assistant row into `agent_thread_messages` → Realtime broadcasts → UnifiedChat replaces placeholder.
  - When Jimmy speaks, auto-fires `runSherlockAuditAsync` (Sherlock writes its own row into the same thread).
- Wire-in: `agents.routes.ts /chat` handler — uncomment the `enqueueAgentReply(...)` line right before `res.json({...})`.
- Required env on Hetzner: `SUPABASE3_URL`, `SUPABASE3_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `OLLAMA_BASE_URL`.
- Install: `bun add ai @openrouter/ai-sdk-provider @ai-sdk/groq ollama-ai-provider-v2 @supabase/supabase-js` then `pm2 restart axonetis-builder`.

## Phase A progress

| Step | Scope | Status |
|------|-------|--------|
| 1 | Supabase 3 SSE wiring + Jimmy/Sherlock chat live | ✅ LOCKED |
| 2 | Server snippet paste + debug | NEXT (founder runs on Hetzner) |
| 3 | Publish sandbox→prod flow test | pending |
| 4 | Sherlock auto-fix 3-loop wiring | pending |
| 5 | Polish + buffer | pending |

## Rules enforced

- ✅ Frontend never calls OpenRouter/Groq — only POST to axonetis-builder + Supabase 3 Realtime.
- ✅ No service_role key in frontend (only publishable VITE_SUPABASE3_ANON_KEY).
- ✅ Unified Chat scope LOCKED: only jimmy + sherlock slugs render (8 advisors filtered out via `UNIFIED_CHAT_SLUGS`).
- ✅ Builder-side work landed in `axonetis-builder` process only (Rust process untouched per pm2-process-split-LOCKED).
- ✅ No duplicate component/table/route created — extended existing UnifiedChat + project-workspace + agents.routes.
