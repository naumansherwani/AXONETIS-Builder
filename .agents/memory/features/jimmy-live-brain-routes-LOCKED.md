---
name: Jimmy live brain routes LOCKED
description: Live Jimmy route source on Hetzner brain, model order, verified status, and full-loop milestone (Jimmy tool exec + Sherlock real audit)
type: feature
---
File on server: `/opt/hostflowai-brain/backend/src/routes/founder/jimmy.ts`
Reference copy in repo: `server-snippets/jimmy.routes.ts` (Version A = AI SDK + tools, Version B = raw fetch SSE, Version B is what is LIVE).

Endpoints (brain, port 8080):
- `POST /api/founder/jimmy/stream` — SSE, requires `{ projectId, messages[] }`
- `POST /api/founder/jimmy/orchestrate` — metadata only
- `POST /api/founder/sherlock/audit` — requires `{ content, projectId }` → 200 OK 3-pass verdict
- `POST /api/founder/sherlock/stream`

Model order LOCKED (lines 27-28 of jimmy.ts):
1. `meta-llama/llama-3.3-70b-instruct`
2. `nousresearch/hermes-3-llama-3.1-405b`
3. `qwen/qwen-2.5-coder-32b-instruct`

Env required: `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2` (Sherlock), `SUPABASE3_URL`, `SUPABASE3_SERVICE_ROLE_KEY`, `PROJECTS_ROOT` (default `/opt/axonetis-projects`).
Supabase JS on brain MUST pass `realtime: { transport: ws }` (Node 22).
`ensureProjectExists` auto-seeds slugs: hostflowai, rapidpay, founderbuilder.

Verified 2026-08-07: build OK, pm2 restart OK, stream returns `data: {"type":"done","model":"meta-llama/llama-3.3-70b-instruct"}`.

Milestone reached (full loop green):
- Jimmy uses `execute_command` tool and returned real `pm2 list` output
- Sherlock flagged a genuine finding: all PM2 processes run as root → Principle of Least Privilege violation (real audit, not rubber stamp)
- Memory system working; loop = Jimmy → Tool → Sherlock → Done
Open security item: run PM2 processes under a non-root user.
