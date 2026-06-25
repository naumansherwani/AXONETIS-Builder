# ⚠️ Install axonetis-ssh-bridge on Hetzner (NEW PM2 process)

Founder copy-paste only. One block per step. Run all as root.

---

## Step 1 — Create dir & files

```bash
mkdir -p /opt/hostflow-ecosystem/axonetis-ssh-bridge && cd /opt/hostflow-ecosystem/axonetis-ssh-bridge
```

## Step 2 — package.json (paste full, overwrite)

```bash
cat > /opt/hostflow-ecosystem/axonetis-ssh-bridge/package.json <<'EOF'
{
  "name": "axonetis-ssh-bridge",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "build": "tsc", "start": "node dist/index.js" },
  "dependencies": { "node-pty": "^1.0.0", "ws": "^8.18.0" },
  "devDependencies": { "@types/node": "^22.5.0", "@types/ws": "^8.5.12", "typescript": "^5.6.0" }
}
EOF
```

## Step 3 — tsconfig.json (paste full)

```bash
cat > /opt/hostflow-ecosystem/axonetis-ssh-bridge/tsconfig.json <<'EOF'
{ "compilerOptions": { "target": "ES2022", "module": "ES2022", "moduleResolution": "Bundler", "esModuleInterop": true, "strict": true, "skipLibCheck": true, "outDir": "dist", "rootDir": "." }, "include": ["index.ts"] }
EOF
```

## Step 4 — index.ts (paste full — content is in ssh-bridge.ts in Lovable repo)

Copy the entire body of `.agents/server-snippets/ssh-bridge.ts` from the Lovable repo into:

```
/opt/hostflow-ecosystem/axonetis-ssh-bridge/index.ts
```

## Step 5 — ecosystem.config.cjs (paste full)

```bash
cat > /opt/hostflow-ecosystem/axonetis-ssh-bridge/ecosystem.config.cjs <<'EOF'
module.exports = {
  apps: [{
    name: "axonetis-ssh-bridge",
    script: "dist/index.js",
    cwd: "/opt/hostflow-ecosystem/axonetis-ssh-bridge",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_memory_restart: "200M",
    env: {
      NODE_ENV: "production",
      SSH_BRIDGE_PORT: "8090",
      SSH_BRIDGE_SHELL: "/bin/bash",
      SSH_BRIDGE_ORIGINS: "https://aiaxonetis.hostflowai.net,https://founderbuilder.axonetis.com"
    }
  }]
};
EOF
```

## Step 6 — install + build

```bash
cd /opt/hostflow-ecosystem/axonetis-ssh-bridge && npm install && npm run build
```

## Step 7 — start under PM2

```bash
pm2 start /opt/hostflow-ecosystem/axonetis-ssh-bridge/ecosystem.config.cjs && pm2 save
```

## Step 8 — Caddy reverse proxy

Edit `/etc/caddy/Caddyfile`. Inside the existing `aiaxonetis.hostflowai.net` (and `founderbuilder.axonetis.com`) site block, add:

```
handle_path /ssh* {
    reverse_proxy 127.0.0.1:8090
}
```

Then:

```bash
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

## Step 9 — verify

```bash
curl -s http://127.0.0.1:8090/health && echo
pm2 status axonetis-ssh-bridge
```

Expected: `ok` and process `online`.

## Step 10 — browser test

Open https://aiaxonetis.hostflowai.net → Terminal tab → click **Connect**.
You should see a live root bash prompt — exactly like `ssh root@88.198.208.90`.
