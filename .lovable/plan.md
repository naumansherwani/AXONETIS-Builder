# Phase A3 — Real Wiring (No Dummy Anywhere)

Bhai sab confirm. Yeh bara kaam hai — 4 tracks. Strict phase split, har track ke baad ruko, "agla" bolo.

## Locked decisions (tumhare confirmation se)

1. **Real SSH terminal** — Hetzner pe naya PM2 process `axonetis-ssh-bridge` (Node + `ws` + `node-pty`) port `:8090`, Caddy `/ssh` → `:8090`. Frontend xterm WebSocket. Auth: root password env var (`HETZNER_ROOT_PASS`) — tumhare existing `ssh root@88.198.208.90` flow ka exact replica, browser ke andar.
2. **8 GitHub accounts** — founder picker (dropdown in GitHub tab header). Har account ka PAT separate secret: `GITHUB_PAT_1` … `GITHUB_PAT_8` + label registry. Switch karte hi repos/branches/PRs reload.
3. **Single GitHub tab** — side-rail se duplicate `GIT` icon remove. Ek `GITHUB` tab, sub-tabs: Commits / Branches / PRs / Diff.
4. **Chat right arrow rail REMOVE** — chat sirf native scroll + keyboard.
5. **Left NAVIGATE rail** — add vertical scroll-thumb + up/down arrows column (jaisa pic 7 mein).
6. **Mobile-only keyboard auto-pop** — `matchMedia('(pointer: coarse)')` check; desktop pe focus auto nahi.
7. **Deep audit** — har existing button/feature: ya to real wire, ya hide. Zero dummy.

## Track split (4 turns)

### A3.1 — Real SSH Terminal (this turn, ~5 credits)
**Frontend:**
- `TerminalPanel.tsx` rewrite: connect to `wss://aiaxonetis.hostflowai.net/ssh` via WebSocket; pipe raw bytes both ways (xterm `onData` → ws.send, `ws.onmessage` → term.write).
- Connect/disconnect status chip; auto-reconnect with backoff; resize → send `{type:"resize",cols,rows}` JSON frame.
- Empty state: "Connect to root@88.198.208.90" button.

**Server snippet (founder paste on Hetzner):**
- `.agents/server-snippets/ssh-bridge.ts` — Node + `ws` + `node-pty`. Spawns `ssh root@88.198.208.90` (or directly `bash` since bridge runs ON Hetzner — no SSH hop needed, just spawn `bash` as root since PM2 runs as root). Forwards PTY ↔ WS.
- `.agents/server-snippets/ssh-bridge.ecosystem.cjs` — PM2 config.
- `.agents/server-snippets/Caddyfile.snippet` — `handle_path /ssh*` → `reverse_proxy 127.0.0.1:8090` with WebSocket upgrade.
- Full copy-paste install block (numbered steps, single paste per step).

**Decision detail:** Bridge runs ON Hetzner as root via PM2 → no SSH password needed, just `spawn('bash', ['-l'])` with `node-pty`. Tumhe browser mein wahi root shell milega. Yeh actually behtar hai (no password in env, no SSH key dance).

### A3.2 — GitHub multi-account real wiring (next turn, ~5 credits)
- Server route `src/routes/api/github/accounts.ts` — lists 8 configured accounts (label only, no PAT leak).
- Server route `src/routes/api/github/$account.repos.ts`, `.branches.ts`, `.commits.ts`, `.prs.ts`, `.diff.ts` — proxies to `api.github.com` with matching PAT secret.
- `GitHubPanel.tsx` rewrite: account dropdown (top-left) → repo dropdown → branch dropdown → sub-tabs (Commits/Branches/PRs/Diff).
- Monaco diff fed by real `git diff` from `/api/github/.../diff`.
- Secrets: I'll prompt for `GITHUB_PAT_1`..`GITHUB_PAT_8` + `GITHUB_ACCOUNTS_JSON` (label+username map) via `add_secret`.

### A3.3 — Side rail + chat cleanup (next turn, ~3 credits)
- `SideRail.tsx`: remove duplicate `GIT` entry, keep only `GITHUB`. Add vertical scroll-thumb + ▲/▼ arrows column on right edge of rail.
- `UnifiedChat.tsx`: remove right-side arrow rail completely; native scroll only.
- Mobile keyboard: composer `autoFocus` only when `matchMedia('(pointer: coarse)').matches`.

### A3.4 — Deep feature audit (next turn, ~4 credits)
- Walk every panel (Logs, Database, Runtime, Files, Command, Versions, Memory, Agents, Analytics, Deploy, Activity, DualBrain, Projects).
- Each button: wire to real endpoint OR hide. No dummy `console.log`, no fake data arrays.
- Status bar chips: real PM2 status from `/api/hetzner/status` (already exists in bridge).
- Report card at end: feature → status (LIVE / HIDDEN / TODO with reason).

## What I'll deliver THIS turn (A3.1 only)

1. `src/components/builder/workspace/TerminalPanel.tsx` — real WS xterm client.
2. `.agents/server-snippets/ssh-bridge.ts` — full file (node-pty + ws).
3. `.agents/server-snippets/ssh-bridge.package.json` — deps.
4. `.agents/server-snippets/ssh-bridge.ecosystem.cjs` — PM2.
5. `.agents/server-snippets/Caddyfile.ssh.snippet` — reverse-proxy block.
6. Copy-paste install instructions (numbered, one block per step) marked **⚠️ YEH HOSTFLOW-SERVER (BRIDGE) REPO KI FILE HAI** (new sibling dir `/opt/hostflow-ecosystem/axonetis-ssh-bridge`).
7. Memory update: `mem://features/axonetis-ssh-bridge-LOCKED.md`.

Confirm karo → "Agla A3.1" bolo, start karta hoon. Ya kuch tweak chahiye to abhi bolo.
