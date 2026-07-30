# AXONETIS Builder — Health Endpoints (LOCKED)

Single source of truth: `src/lib/health.server.ts`. No duplicate logic anywhere.

| Route | Auth | Use |
|---|---|---|
| `/health` | site auth | quick browser/manual check |
| `/api/health` | site auth | internal service check |
| `/api/system/health` | site auth | PM2 / ops dashboards |
| `/api/public/health` | **none** (`/api/public/*` bypass) | Caddy, uptime monitors, external probes |

All four return the identical payload and `cache-control: no-store`:

```json
{
  "ok": true,
  "service": "axonetis-builder",
  "status": "ok",
  "version": "1.0.0",
  "uptime_s": 0,
  "time": "2026-07-30T01:16:34.457Z",
  "endpoints": ["/health", "/api/health", "/api/system/health", "/api/public/health"]
}
```

`version` comes from `APP_VERSION` env (defaults `1.0.0`). `uptime_s` is per-process since boot.

Smoke test:

```bash
for U in /health /api/health /api/system/health /api/public/health; do
  curl -s -o /dev/null -w "$U:%{http_code}\n" http://127.0.0.1:3000$U
done
```

Expected: `200` on all four.
