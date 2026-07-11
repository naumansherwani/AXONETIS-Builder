# INSTALL — Phase 3.9.6 + 3.9.7 (Marketplace + Global Router)

Founder-only Hetzner deploy on `aiaxonetis.hostflowai.net`.
NO DUPLICATE — everything appends to existing files from 3.9.3/3.9.4.

## 1. Apply migration (Supabase 3 = axonetis-builder)

```bash
cd /var/www/NEXATECT-Engine
psql "$SUPABASE3_DB_URL" -f /var/www/axonetis/hetzner-migrations/20260711000002_phase_396_397_marketplace_router.sql
```

Verifies:
```sql
select count(*) from public.marketplace_agents;   -- expect 5 seeded
select column_name from information_schema.columns
  where table_name='agent_thread_messages' and column_name in ('cost_usd','saved_vs_default_usd','default_model');
```

## 2. Wire new RPC routes into existing router

Copy `server-snippets/rpc-phase-396-397.additions.ts` into
`/var/www/NEXATECT-Engine/server/routes/` and register once inside the
existing `rpc.routes.ts` (right below the 3.9.3/3.9.4 registrations —
NO duplicate router instance):

```ts
import { registerRouterAndMarketplaceRoutes } from "./rpc-phase-396-397.additions";
registerRouterAndMarketplaceRoutes(router, supabase3);
```

## 3. Stamp cost on every assistant reply (agent worker)

In `axonetis-builder` worker, at the end of each `streamText` completion,
call the helper attached to the router:

```ts
await (router as any).logRouterDecision({
  thread_id, message_id, project_id, agent_slug: "jimmy",
  chosen_model, default_model: "anthropic/claude-3.5-sonnet",
  tier, input_tokens, output_tokens, reason,
});
```

That single call:
- inserts a row in `router_decisions`
- updates `agent_thread_messages.cost_usd` + `saved_vs_default_usd` + `default_model`
- frontend Realtime picks it up → cost + savings badges light up on the message

## 4. Restart

```bash
cd /var/www/axonetis && git pull && bun install && bun run build \
  && pm2 restart axonetis-builder \
  && pm2 logs axonetis-builder --lines 30 --nostream
```

## 5. Smoke test

```bash
# Router preview
curl -sX POST https://aiaxonetis.hostflowai.net/rpc/router.preview \
  -H 'content-type: application/json' \
  -d '{"prompt":"fix the button color","agent":"jimmy"}'

# Marketplace list
curl -s https://aiaxonetis.hostflowai.net/rpc/marketplace.list | jq '.agents | length'

# Install seo-scout on a project
curl -sX POST https://aiaxonetis.hostflowai.net/rpc/marketplace.install \
  -H 'content-type: application/json' \
  -d '{"projectId":"axonetis","slug":"seo-scout"}'
```

## 6. Frontend endpoints wired

- `src/lib/marketplace-api.ts` → list/installed/install/uninstall
- `src/lib/router-api.ts` → previewRoute (chat composer footer chip)
- `src/components/builder/panels/MarketplacePanel.tsx` → new right-rail panel
- `src/components/builder/UnifiedChat.tsx` → per-message cost/savings badges + voice deploy intent

If any endpoint is unreachable, the frontend degrades gracefully to
`null` / `[]` per the constitutional principle — no crashes, no dummy data.
