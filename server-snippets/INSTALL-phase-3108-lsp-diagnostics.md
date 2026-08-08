# Phase 3.10.8 — LSP inline diagnostics (install)

Frontend (Lovable repo) done: `src/lib/lsp-api.ts`, `src/hooks/useDiagnostics.ts`,
CodePanel squiggles + hover + Fix button + Problems badge, StatusBar Problems badge.

Backend = 1 new bridge route file + 1 Supabase 3 migration.

## STEP 1 — ⚠️ YEH SUPABASE 3 SQL

Run `hetzner-migrations/20260809000000_phase_3108_lsp_diagnostics.sql` in the
Supabase 3 SQL editor (idempotent — dobara chalane se kuch nahi tootega).

## STEP 2 — ⚠️ YEH HOSTFLOW-SERVER (BRIDGE)

```bash
cd /var/www/axonetis && git pull && bun install && bun run build && \
pm2 restart axonetis-builder && \
cd /opt/hostflow-ecosystem/hostflow-server && \
cp /var/www/axonetis/server-snippets/lsp.routes.ts src/routes/lsp.routes.ts && \
grep -q 'lsp.routes' src/index.ts || sed -i "0,/^app.use(/s##import { lspRouter } from './routes/lsp.routes.js';\napp.use('/rpc', lspRouter);\n&#" src/index.ts; \
bun run build && pm2 restart hostflow-server --update-env && sleep 4 && \
curl -sS -w "\nlsp.diagnostics:%{http_code}\n" -X POST http://127.0.0.1:8090/rpc/lsp.diagnostics -H 'content-type: application/json' -d '{}' | head -3 && \
curl -sS -w "\nlsp.autofix:%{http_code}\n" -X POST http://127.0.0.1:8090/rpc/lsp.autofix -H 'content-type: application/json' -d '{}' | head -3
```

Expected: `lsp.diagnostics:400` + `lsp.autofix:400` (validation = routes live).

If the `sed` mount line doesn't land, mount manually next to the other routers in
`src/index.ts`:

```ts
import { lspRouter } from './routes/lsp.routes.js';
app.use('/rpc', lspRouter);
```

## STEP 3 — real scan smoke (asli project par)

```bash
curl -sS -X POST http://127.0.0.1:8090/rpc/lsp.diagnostics \
  -H 'content-type: application/json' \
  -d '{"projectId":"founderbuilder"}' | head -c 600; echo
```

Expected: `{"ok":true|false,"errorCount":N,...}` — aur Builder UI ka Problems badge
Realtime se turant update ho jayega.
