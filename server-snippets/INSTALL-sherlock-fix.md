# INSTALL — Sherlock Fix (AI SDK v4 system message error)

Ek copy-paste block. Full-file overwrite — koi sed/patch nahi.

## Pre-check

Registry file pehle se hona chahiye:

```bash
test -f /opt/hostflowai-brain/backend/src/config/ai-models.ts && echo "registry ok" || echo "RUN INSTALL-awam-model-registry.md first"
```

## Install

```bash
pm2 update && \
cp /var/www/axonetis/server-snippets/sherlock.routes.ts \
   /opt/hostflowai-brain/backend/src/routes/founder/sherlock.ts && \
cd /opt/hostflowai-brain/backend && \
bun install && \
bun run build && \
pm2 restart hostflowai-brain --update-env && \
sleep 3 && \
echo "--- health checks ---" && \
curl -sS -o /dev/null -w 'brain health:%{http_code}\n' http://127.0.0.1:8080/api/health && \
curl -sS -o /dev/null -w 'sherlock audit:%{http_code}\n' -X POST http://127.0.0.1:8080/api/founder/sherlock/audit -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"ping"}],"projectId":"founderbuilder"}' && \
echo "--- last 10 error lines ---" && \
tail -n 10 /root/.pm2/logs/hostflowai-brain-error.log
```

## Expected

- `brain health:200`
- `sherlock audit:200`
- Error log mein `InvalidPromptError` NAHI hona chahiye

## Hard rule

Vercel AI SDK v4+ mein `messages` array mein `role: "system"` hargiz mat bhejo. Hamesha `system: ...` parameter use karo.
