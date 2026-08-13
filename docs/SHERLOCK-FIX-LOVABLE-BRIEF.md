# Sherlock Brain Fix — Lovable Brief

## Problem

`hostflowai-brain` process logs show:

```
InvalidPromptError [AI_InvalidPromptError]: Invalid prompt: System messages are not allowed in the prompt or messages fields. Use the instructions option instead.
    at standardizePrompt (/opt/hostflowai-brain/node_modules/ai/src/prompt/standardize-prompt.ts:89:11)
    ...
    at /opt/hostflowai-brain/backend/src/routes/founder/sherlock.ts:223:20
```

Root cause: `sherlock.ts` still passes the system prompt inside the `messages` array as `{ role: "system", content: "..." }`. Vercel AI SDK v4+ rejects this. The system prompt must be passed as a separate `system:` parameter on `streamText` / `generateText`.

## Fix

File to replace on Hetzner:

```
/opt/hostflowai-brain/backend/src/routes/founder/sherlock.ts
```

Replacement: `server-snippets/sherlock.routes.ts` (in the `axonetis` Lovable repo).

Key changes:

1. **Move system prompt out of `messages` array:**

```ts
// WRONG — causes InvalidPromptError
streamText({
  messages: [{ role: "system", content: SYSTEM }, ...messages],
});

// RIGHT
streamText({
  system: SHERLOCK_SYSTEM(projectId),
  messages: normalizeMessages(messages), // user + assistant only
});
```

2. **Use the new master AI model registry** (`getModelConfig`) so Sherlock uses the same DeepInfra models as the rest of the stack:
   - Primary: `deepseek-ai/DeepSeek-R1-0528` (DI1)
   - Fallback: `deepseek-ai/DeepSeek-V4-Pro` (DI1)

3. **Keep both routes alive** so existing frontend calls continue to work:
   - `POST /api/founder/sherlock/audit` — canonical audit route
   - `POST /api/founder/sherlock/stream` — backwards-compatible alias

4. **Founder voice guard** stays in place: if output contains generic AI-speak, it is rejected and falls back to the next tier.

## Install commands on Hetzner

```bash
# 1. Make sure the master AI model registry is already copied to the brain
mkdir -p /opt/hostflowai-brain/backend/src/config && \
cp /var/www/axonetis/server-snippets/ai-models.registry.ts \
   /opt/hostflowai-brain/backend/src/config/ai-models.ts && \
echo "✅ ai-models.ts ready"

# 2. Replace the Sherlock route with the fixed version
cp /var/www/axonetis/server-snippets/sherlock.routes.ts \
   /opt/hostflowai-brain/backend/src/routes/founder/sherlock.ts && \
echo "✅ sherlock.ts replaced"

# 3. Build and restart
pm2 update && \
cd /opt/hostflowai-brain/backend && \
bun install && \
bun run build && \
pm2 restart hostflowai-brain --update-env && \
sleep 3 && \
curl -sS -o /dev/null -w 'brain health:%{http_code}\n' http://127.0.0.1:8080/api/health && \
curl -sS -o /dev/null -w 'jimmy stream:%{http_code}\n' -X POST http://127.0.0.1:8080/api/founder/jimmy/stream -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"ping"}],"projectId":"founderbuilder"}' && \
curl -sS -o /dev/null -w 'sherlock audit:%{http_code}\n' -X POST http://127.0.0.1:8080/api/founder/sherlock/audit -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"ping"}],"projectId":"founderbuilder"}' && \
pm2 logs hostflowai-brain --lines 20 --nostream
```

## Verification

After restart, the `InvalidPromptError` must disappear from `hostflowai-brain-error.log` and `curl -X POST /api/founder/sherlock/audit` should return `200` with SSE headers.

## Note on the DATABASE_URL warning

The logs also show:

```
Error: DATABASE_URL must be set. Did you forget to provision a database?
    at /opt/hostflowai-brain/libs/db/src/index.ts:8:9
```

This is a separate issue. The brain process starts because the chat route does not depend on `libs/db`, but some other module (possibly a background worker or monitor) imports it. If this error is blocking a feature, verify the `.env` for `hostflowai-brain` has `DATABASE_URL` or `SUPABASE3_DATABASE_URL` set, and that `libs/db` reads the correct variable. This brief only fixes the Sherlock `InvalidPromptError`.

## Rule to lock

**Never put `role: "system"` messages inside the `messages` array when using Vercel AI SDK v4+. Always use `system: ...` parameter.**
