---
name: Backend Snippet Imports + Idempotent SQL LOCKED
description: Jun 13 2026 failure lock: hostflow-server has no src/clients/supabase3; backend snippets must use existing tree or inline Supabase 3 client, and SQL policies must be idempotent.
type: constraint
---

# LOCKED — Backend snippet import + SQL idempotency failure lesson

Founder hit production red on Hetzner:

`ERR_MODULE_NOT_FOUND: Cannot find module .../hostflow-server/src/clients/supabase3 imported from src/routes/agents.routes.ts`

## Mandatory rules

1. **Never import `src/clients/supabase3` in hostflow-server snippets.** That path is not in the locked file tree.
2. For hostflow-server route snippets, prefer inline server-side client:
   - `import { createClient } from "@supabase/supabase-js"`
   - `createClient(process.env.SUPABASE3_URL!, process.env.SUPABASE3_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })`
3. If reusing a server client, only use confirmed tree path: `integrations/supabase3/client.ts` — but do not assume its export shape unless founder showed file contents.
4. SQL migrations sent to founder must be **safe to re-run**:
   - `create table if not exists`
   - enum wrapped in `do $$ ... exception when duplicate_object then null; end $$;`
   - indexes `if not exists`
   - policies: `drop policy if exists ...` before `create policy ...`
   - grants included every time for public tables
5. If user reports `policy ... already exists`, do not resend the same SQL. Send corrected idempotent SQL only.

## Why

Founder copy-pastes only. Bad imports or non-idempotent SQL wastes server time and breaks Phase 3/4. Lovable must own this completely.