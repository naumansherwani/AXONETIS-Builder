# Phase 3.10.9 — INSTALL 12/12 agent tools (bridge)

Verified host: `ubuntu-24gb-nbg1-1`
Bridge repo: `/opt/hostflow-ecosystem/hostflow-server` (PM2 `hostflow-server`, :8090)
Builder repo: `/var/www/axonetis` (PM2 `axonetis-builder`, :3000)

## STEP 1 — Builder pull (source of the snippet)

```bash
cd /var/www/axonetis && git checkout -- src/routeTree.gen.ts 2>/dev/null; git pull && bun install && bun run build && pm2 restart axonetis-builder && pm2 logs axonetis-builder --lines 20 --nostream
```

## STEP 2 — Copy tools into the bridge + deps

```bash
cd /opt/hostflow-ecosystem/hostflow-server && \
cp /var/www/axonetis/server-snippets/agents.tools.ts src/routes/agents.tools.ts && \
cp /var/www/axonetis/server-snippets/agents.worker.ts src/routes/agents.worker.ts && \
bun add pg ws @supabase/supabase-js ai zod && \
bun run build && pm2 restart hostflow-server --update-env && sleep 4 && \
pm2 logs hostflow-server --lines 20 --nostream
```

If `agents.worker.ts` already lives at another path in the bridge, copy `agents.tools.ts` next to it
and keep the existing import `./agents.tools.js` — do NOT create a second worker file.

## STEP 3 — Env (bridge `.env`)

```bash
cd /opt/hostflow-ecosystem/hostflow-server && \
grep -q PROJECTS_ROOT .env || printf '\nPROJECTS_ROOT=/opt/axonetis-projects\nPREVIEW_BASE_URL=http://127.0.0.1:8091\nBRIDGE_SELF_URL=http://127.0.0.1:8090\n' >> .env; \
grep -E '^(PROJECTS_ROOT|PREVIEW_BASE_URL|BRIDGE_SELF_URL|DATABASE_URL|SUPABASE3_URL)=' .env | sed 's/=.*/=SET/'
```

## STEP 4 — Smoke (expect 400 = route/tool layer live, validation working)

```bash
curl -sS -w "\ndelegate.create:%{http_code}\n" -X POST http://127.0.0.1:8090/rpc/delegate.create -H 'content-type: application/json' -d '{}' | head -3
curl -sS -w "\ntools.abort:%{http_code}\n" -X POST http://127.0.0.1:8090/rpc/tools.abort -H 'content-type: application/json' -d '{}' | head -3
```

Real `200` sirf Jimmy ke asli run par aayega (tool call → `tool_call_registry` row → UI bubble).

## Notes
- `screenshot_preview` needs Playwright chromium on the bridge: `bunx playwright install chromium`.
- `run_sql` + `deploy` are `needsApproval` — they will pause for founder approval in the UI, by design.
