---
name: Builder Phase Sequence LOCKED
description: Locked implementation order for AXONETIS Builder phases. Zero deviation.
type: constraint
---
Order:
1. 3.9.1 Chatbox (~90% — pending: tool-call cards, diff preview, voice mic)
2. 3.9.2 Sidebar (all panels real wiring)
3. 3.9.3 Domains (Caddy + DNS)
4. 3.9.4 Versions (commits + Monaco diff)
5. 3.10 Tool Registry (12 tools + ToolCallBubble)
6. 3.10.9 Rust agents.routes.ts v2 SSE (server repo NEXATECT-Engine)
7. 3.10.10 Supabase 3 tables (tool_calls, agent_subagents, mem_entries)
8. Phase 9 Trojan Horse CRM
9. Phase 10 Advantage Layer (16)
10. Phase 11 Outreach Engine
11. Phase 12 Final Lock

parent_message_id red = handled via fallback; permanent fix is Hetzner SQL:
`ALTER TABLE public.agent_thread_messages ADD COLUMN IF NOT EXISTS parent_message_id UUID;`
