---
name: Hetzner verified paths LOCKED
description: Verified host, git repo paths and PM2 cwd/exec paths on Hetzner (Aug 2026) — use these exact paths in every command, never guess
type: constraint
---

# Verified on host `ubuntu-24gb-nbg1-1` (Aug 8 2026)

## Repos (only these exist)
- Builder (Lovable repo, port 3000): `/var/www/axonetis`
- Bridge / RPC server (`hostflow-server`): `/opt/hostflow-ecosystem/hostflow-server`  ← **NOT** `/root/hostflow-server`
- Brain (`hostflowai-brain`, port 8080): `/opt/hostflowai-brain/backend`
- Rust engine: `/root/hostflow-engine`
- SSH bridge: `/opt/hostflow-ecosystem/axonetis-ssh-bridge`
- Others (do not touch): `/opt/axonetis-builder`, `/opt/AXONETIS-Builder`, `/opt/hostflow-brain`, `/opt/hostflow-ecosystem/builder-app`, `/opt/hostflow-ecosystem/founder-ai-builder`, `/opt/hostflow-ecosystem/rapid-dialogue-guide`, `/opt/hostflow-frontend`, `/var/www/nexatect`

## PM2 (8 processes, all online)
| name | cwd | exec |
|---|---|---|
| schema-evolution | /opt/hostflowai-brain/backend | dist/listen-schema-evolution.mjs |
| runtime-schema-sync | /opt/hostflowai-brain/backend | dist/runtime-schema-sync.mjs |
| hostflow-server | /opt/hostflow-ecosystem/hostflow-server | /usr/bin/npm |
| axonetis-rust-human | /root/hostflow-engine | target/release/hostflow-engine |
| axonetis-ssh-bridge | /opt/hostflow-ecosystem/axonetis-ssh-bridge | dist/index.js |
| hostflowai-brain | /opt/hostflowai-brain/backend | dist/index.mjs |
| axonetis-builder | /var/www/axonetis | /usr/bin/bash |
| aanris-runtime | /opt/hostflowai-brain/backend | src/runtime-nervous-system/aanris-bootstrap.ts |

**Rule:** `hostflow-server` runs via npm → build/start scripts are npm, but bun install/build bhi chalta hai. Bridge port = 8090, brain = 8080, builder = 3000.
**Rule:** Kabhi bhi path guess nahi karna — is file se hi path lena hai.
