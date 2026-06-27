---
name: AXONETIS SSH Bridge LOCKED
description: Real PTY terminal in browser via standalone PM2 process axonetis-ssh-bridge on Hetzner. node-pty + ws on 127.0.0.1:8092, Caddy /ssh → :8092. Bridge runs as root so spawn bash directly (no SSH hop). Frontend = xterm WebSocket client. Single origin = founderbuilder.axonetis.com.
type: feature
---

# LOCKED — Phase A3.1 (Jun 27, 2026)

## Architecture
- Standalone PM2 process: `axonetis-ssh-bridge` (id 10)
- Path: `/opt/hostflow-ecosystem/axonetis-ssh-bridge/`
- Stack: Node 22 + `ws` + `node-pty`, TypeScript
- Listens: `127.0.0.1:8092` (loopback only — 8090 was busy with hostflow-server)
- Caddy: inside founderbuilder.axonetis.com `@founder_only` block, `handle_path /ssh*` → `reverse_proxy 127.0.0.1:8092`
- WS URL (prod): `wss://founderbuilder.axonetis.com/ssh` — **ONLY** this origin
- Origin allowlist env `SSH_BRIDGE_ORIGINS=https://founderbuilder.axonetis.com`

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

## Hard rules
1. NEVER expose port 8092 publicly — Caddy proxy only, with origin check.
2. NEVER add a second terminal component. This is THE terminal.
3. Origin allowlist = founderbuilder.axonetis.com ONLY. Do NOT re-add aiaxonetis.hostflowai.net (founder-private builder is at founderbuilder).
4. If founder needs SSH to OTHER hosts, run `ssh user@host` INSIDE the PTY — not a new bridge.
