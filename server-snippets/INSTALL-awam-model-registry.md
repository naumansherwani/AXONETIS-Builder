# INSTALL — AWAM Master AI Model Registry (DeepInfra DI1/DI2)

Ek hi copy-paste block. Full-file overwrite — koi sed/patch nahi.
Repo copy: `server-snippets/ai-models.registry.ts`

## STEP 1 — env check (DI keys)

```bash
cd /opt/hostflowai-brain/backend && grep -c DEEPINFRA_API_KEY_1 .env || echo "MISSING DEEPINFRA_API_KEY_1"
```

Agar missing ho to `.env` mein add karo (values founder ke paas):

```
DEEPINFRA_API_KEY_1=...
DEEPINFRA_API_KEY_2=...
```

## STEP 2 — registry file create (full overwrite)

```bash
mkdir -p /opt/hostflowai-brain/backend/src/config && \
cp /var/www/axonetis/server-snippets/ai-models.registry.ts \
   /opt/hostflowai-brain/backend/src/config/ai-models.ts && \
echo "✅ ai-models.ts written" && \
head -5 /opt/hostflowai-brain/backend/src/config/ai-models.ts
```

Agar `/var/www/axonetis` par yeh snippet abhi na ho: pehle `cd /var/www/axonetis && git pull`.

## STEP 3 — jimmy.ts ko registry par shift karo

`jimmy.ts` ke top par sirf yeh import aur chain use karo (sed nahi — file ka poora block founder ko alag se diya jayega):

```ts
import { getModelConfig, LIMITS } from "../../config/ai-models.js";

const JIMMY_CHAIN = ["primary", "code", "fallback", "free"] as const;
// per attempt: const { model, endpoint, apiKey } = getModelConfig("jimmy", tier);
```

Founder tier: `getModelConfig("jimmy_founder", "primary")`.
Sherlock: `getModelConfig("sherlock", "primary" | "fallback")`.
Aria: `getModelConfig("aria", "primary" | "deep" | "fallback")`.

## STEP 4 — build + restart + verify

```bash
cd /opt/hostflowai-brain/backend && bun install && bun run build && \
pm2 restart hostflowai-brain --update-env && sleep 3 && \
curl -sS -o /dev/null -w 'brain:%{http_code}\n' http://127.0.0.1:8080/health && \
pm2 logs hostflowai-brain --lines 20 --nostream
```

## Hard rules
- Awam/free users: OR3 free models + DI1 free slot only, **5 msgs/day** cap (`LIMITS.free`).
- OR1 (paid) sirf founder + LYRA safety fallback.
- Keys sirf server `.env` mein — frontend `.env` mein kabhi nahi.
