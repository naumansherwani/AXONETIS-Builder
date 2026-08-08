# Phase 3.10.9 — bridge typecheck fix (hostflow-server)

10 TS errors ka root cause: 3 missing files/deps + 2 type widening. Frontend repo mein
`agents.worker.ts` + `agents.tools.ts` fix ho gaye. Bridge par sirf deps + cancel file chahiye.

## Hetzner — ek command (bridge repo)

```bash
cd /opt/hostflow-ecosystem/hostflow-server && \
cp /var/www/axonetis/server-snippets/agents.cancel.ts   src/routes/agents.cancel.ts && \
cp /var/www/axonetis/server-snippets/agents.tools.ts    src/routes/agents.tools.ts && \
cp /var/www/axonetis/server-snippets/agents.worker.ts   src/routes/agents.worker.ts && \
bun add playwright @openrouter/ai-sdk-provider @ai-sdk/groq ollama-ai-provider-v2 && \
bun add -d @types/ws @types/pg && \
bun run build && pm2 restart hostflow-server --update-env && sleep 4 && \
curl -sS -w "\ndelegate.create:%{http_code}\n" -X POST http://127.0.0.1:8090/rpc/delegate.create -H 'content-type: application/json' -d '{}' | head -3
```

Expected: `$ tsc` clean (0 errors), `delegate.create:400` (validation = route live).

## Kya fix hua

| Error | Fix |
| --- | --- |
| `ws` implicit any | `bun add -d @types/ws` |
| `pg` implicit any | `bun add -d @types/pg` |
| `playwright` not found | `bun add playwright` (browsers already downloaded) |
| `@openrouter/ai-sdk-provider`, `@ai-sdk/groq`, `ollama-ai-provider-v2` | `bun add` — runtime par bhi zaroori (failover chain) |
| `./agents.cancel.js` not found | `agents.cancel.ts` copy (Stop button registry) |
| `messages` null in ModelMessage[] | `toCoreMessage` result par type-predicate filter |
| `PatchOperation.action` string | `as const` literal union |
