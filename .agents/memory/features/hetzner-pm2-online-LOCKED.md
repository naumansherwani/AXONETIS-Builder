---
name: Hetzner PM2 Processes ONLINE — Bridge Live LOCKED
description: Proof snapshot Jun 13 2026 — all 6 ecosystem processes online on Hetzner: aanris-runtime, axonetis-builder, hostflow-server (bridge), hostflowai-brain, runtime-schema-sync, schema-evolution. agents.routes wired into hostflow-server index.ts. pm2 save done.
type: reference
---

# LOCKED — Hetzner ecosystem live (Jun 13 2026)

PM2 dump on `root@ubuntu-16gb-nbg1-1:/opt/hostflow-ecosystem/hostflow-server`:

| id | name | mode | status | mem |
|----|------|------|--------|-----|
| 0 | aanris-runtime | fork | online | 74.7mb |
| 6 | axonetis-builder | fork | online | 60.2mb |
| 7 | hostflow-server (BRIDGE) | fork | online | 3.8mb |
| 2 | hostflowai-brain | fork | online | 1.8gb |
| 3 | runtime-schema-sync | fork | online | 69.9mb |
| 1 | schema-evolution | fork | online | 72.1mb |

- `agentsRouter` mounted on `/api/agents` inside `hostflow-server/src/index.ts`.
- `pm2 save` → `/root/.pm2/dump.pm2`.
- Bridge confirmed live for Phase 3 agents API.

Implication: backend endpoint contract is REAL. Phase 4 (Dual-Brain) backend additions go into the SAME `hostflow-server` repo (BRIDGE), NOT axonetis-builder process. Founder pastes; Lovable writes.
