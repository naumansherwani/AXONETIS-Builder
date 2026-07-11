# AXONETIS Build Sequence — LOCKED

Order (no deviation):
1. Phase 3.9.1 — Chatbox (90% done: tool-call cards, diff preview, voice pending)
2. Phase 3.9.2 — Sidebar panels (Files/Cloud/Domains/Versions/Tools/Costs/Security/Logs/Analytics)
3. Phase 3.9.3 — Domains (Caddy + DNS UI)
4. Phase 3.9.4 — Versions (commits + Monaco diff + restore)
5. Phase 3.10 — Tool Registry (12 tools Zod + ToolCallBubble)
6. Phase 3.10.9 — Agents Runtime v2 SSE (Hetzner Rust — server repo)
7. Phase 3.10.10 — Supabase 3 tables (tool_calls, agent_subagents, mem_entries)
8. Phase 9 — Trojan Horse CRM Connect
9. Phase 10 — Advantage Layer (16 features)
10. Phase 11 — Outreach Engine
11. Phase 12 — Final Lock (Settings + Onboarding + Help)

## parent_message_id red
Frontend + server-route fallback already implemented. Permanent fix on Hetzner Supabase 3:
```sql
ALTER TABLE public.agent_thread_messages ADD COLUMN IF NOT EXISTS parent_message_id UUID;
```
