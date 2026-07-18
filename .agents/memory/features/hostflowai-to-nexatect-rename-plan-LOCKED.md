---
name: hostflowai → nexatect rename plan LOCKED
description: Jun 2026 — founder wants brand rename from "hostflowai" to "nexatect" across DB slugs, PM2 process names, repo paths, and code strings, WITHOUT breaking wiring. Do NOT execute in one mega command; staged plan below.
type: feature
---

# Rename hostflowai → nexatect (staged, safe)

Founder ka goal: sirf naam change, sab wiring same. Ek shot mega command **safe nahi** hai kyunki:
- PM2 process `hostflowai-brain` ka name change karne se Caddy upstream break hoga
- DB slug `hostflowai` change karne se `agents`, `projects`, `agent_runs`, `agent_thread_messages` ke foreign keys hilenge
- `/opt/hostflowai-brain/` path pe env files, systemd, Caddyfile references hain

## Staged rename (do NOT combine)

### Stage 1 — DB slug alias (non-breaking)
Add row: `INSERT INTO projects (slug, name) VALUES ('nexatect', 'NEXATECT™') ON CONFLICT DO NOTHING;`
Keep `hostflowai` row alive as alias. UI reads both. No FKs break.

### Stage 2 — Code string swap (frontend)
Replace user-facing strings `"HostFlow AI"` / `"hostflowai"` → `"NEXATECT"` / `"nexatect"` in:
- src/lib/hostflow-api.ts constants only
- Panel labels, breadcrumbs, page titles
- Do NOT rename the file itself yet. Do NOT rename `VITE_HOSTFLOW_SERVER_URL` env var yet.

### Stage 3 — PM2 alias process
`pm2 start ... --name nexatect-brain` running SAME entry as `hostflowai-brain`, on a DIFFERENT port. Prove parity with curl. Then flip Caddy upstream to new port. Then delete old.

### Stage 4 — Path + env rename
Move `/opt/hostflowai-brain/` → `/opt/nexatect-brain/` with symlink for backward compat. Rename env vars with dual-read fallback in code.

### Stage 5 — DB slug flip
Rename slug `hostflowai` → `nexatect` in `projects`. Update all rows in dependent tables that stored the string. Drop alias.

**Rule:** Har stage ke baad `curl` smoke + browser test. Fail hua toh rollback, next stage nahi.

Cross-ref: no-next-phase-until-wired-LOCKED, company-name-nexatect-only-LOCKED.
