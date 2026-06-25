---
name: AXONETIS SSH Bridge LOCKED
description: Real PTY terminal in browser via standalone PM2 process axonetis-ssh-bridge on Hetzner. node-pty + ws on 127.0.0.1:8090, Caddy /ssh → :8090. Bridge runs as root so spawn bash directly (no SSH hop). Frontend = xterm WebSocket client.
type: feature
---

# LOCKED — Phase A3.1 (Jun 25, 2026)

## Architecture
- Standalone PM2 process: `axonetis-ssh-bridge`
- Path: `/opt/hostflow-ecosystem/axonetis-ssh-bridge/`
- Stack: Node 22 + `ws` + `node-pty`, TypeScript
- Listens: `127.0.0.1:8090` (loopback only)
- Caddy: `handle_path /ssh*` → `reverse_proxy 127.0.0.1:8090` (auto WS upgrade)
- WS URL (prod): `wss://aiaxonetis.hostflowai.net/ssh` and `wss://founderbuilder.axonetis.com/ssh`
- Origin allowlist via env `SSH_BRIDGE_ORIGINS`

## Auth model
Bridge runs as root under PM2 → no SSH password needed.
PTY spawns `/bin/bash -l` directly. Equivalent to `ssh root@88.198.208.90`
because the bridge IS already root on that box. Browser session = root shell.

## Protocol
- Plain text frames = stdin → PTY
- JSON frame `{"type":"resize","cols":N,"rows":N}` = resize
- PTY stdout/stderr → text frames back to browser

## Files
- Frontend: `src/components/builder/workspace/TerminalPanel.tsx`
- Server: `.agents/server-snippets/ssh-bridge.ts`
- Install guide: `.agents/server-snippets/INSTALL-ssh-bridge.md`

## Hard rules
1. NEVER expose port 8090 publicly — Caddy proxy only, with origin check.
2. NEVER add a second terminal component. This is THE terminal.
3. Origin allowlist MUST include every Builder domain.
4. If founder needs SSH to OTHER hosts, change `SHELL` env or spawn `ssh user@host` inside the PTY — not a new bridge.
