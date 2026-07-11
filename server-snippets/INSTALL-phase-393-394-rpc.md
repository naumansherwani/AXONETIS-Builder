# AXONETIS™ — Phase 3.9.3 + 3.9.4 Server Copy-Paste

Founder, yeh woh missing server-side copy-paste hai. Frontend already wired hai; ab Hetzner pe yeh 3 cheezen lagani hain.

## Recommended — one command, no manual edit

```bash
cd /var/www/axonetis && git pull && bash server-snippets/hetzner-wire-phases-393-397.sh
```

Yeh 3.9.3 se 3.9.7 tak saari pending server wiring ek saath karega: DB migrations, `/rpc/*`, Visual Edit bridge, Stop abort verify, build/restart, smoke tests.

Script self-hosted DB URL khud PM2/env files se detect karega. Old cloud `*.supabase.co` URL intentionally reject hota hai. Agar phir bhi na mile:

```bash
AXONETIS_DB_URL='postgresql://USER:PASS@127.0.0.1:5432/DB' bash server-snippets/hetzner-wire-phases-393-397.sh
```

## 1) DB migration

```bash
cd /var/www/axonetis
nano hetzner-migrations/20260711000001_phase_393_394_publish_power_tools.sql
# Lovable repo se same file ka full content paste karo
psql "$AXONETIS_DB_URL" -f hetzner-migrations/20260711000001_phase_393_394_publish_power_tools.sql
```

## 2) RPC router paste

```bash
cd /var/www/axonetis
mkdir -p src/routes
nano src/routes/rpc.routes.ts
# Lovable repo: server-snippets/rpc.routes.ts FULL paste karo
```

Server entry mein **duplicate mat banana**. Agar `/rpc` already mounted hai to existing router extend karo; warna sirf yeh add:

```ts
import rpcRouter from "./routes/rpc.routes.js";
app.use("/rpc", rpcRouter);
```

## 3) Preview iframe visual bridge

Har preview app mein once paste/import:

```bash
# HostFlow preview repo
nano public/axonetis-preview-bridge.js

# ANEXVOT AI Pay preview repo
nano public/axonetis-preview-bridge.js

# AXONETIS preview repo
nano public/axonetis-preview-bridge.js
```

Lovable repo: `server-snippets/preview-visual-edit-bridge.js` ka full content paste karo, phir app shell mein load:

```html
<script src="/axonetis-preview-bridge.js" defer></script>
```

It listens to `visual:edit:toggle` and emits `visual:edit:pick` with one of:
- `hostflow-preview`
- `anexvotaipay-preview`
- `axonetis-preview`

## 4) Build + restart

```bash
cd /var/www/axonetis
bun install
bun run build
pm2 restart axonetis-builder
pm2 logs axonetis-builder --lines 30 --nostream
```

## 5) Smoke tests

```bash
curl "http://127.0.0.1:3000/rpc/publish.state?projectId=founderbuilder"
curl -X POST "http://127.0.0.1:3000/rpc/publish.setVisibility" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"founderbuilder","visibility":"unlisted"}'
curl -X POST "http://127.0.0.1:3000/rpc/sql.validate" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"founderbuilder","query":"create table public.test(id uuid);"}'
```

Expected: JSON response; no frontend fallback warnings.

## Notes

- `Background Sherlock audit skipped: Brain response timeout` frontend ka issue nahi — Hetzner brain timeout hai. Worker mein timeout badhao ya Sherlock background audit ko non-blocking queue se retry karo.
- Caddy attach ke liye process ko `/etc/caddy/sites-enabled` write + `caddy reload` permission chahiye.
- Time-travel endpoint intentionally validates SHA before checkout.
