# Phase A.1 — Jimmy/Sherlock worker paste (Hetzner, axonetis-builder PM2 id 4)

**Target box:** `root@88.198.208.90`
**Target process:** `axonetis-builder` (PM2 id 4)
**Time:** ~3 minutes
**Effect:** Jimmy/Sherlock UI reply unblock — "Working on it…" placeholder ko real LLM reply replace karega via Supabase 3 Realtime.

---

## Step 1 — Files paste karo

Hetzner par SSH karke:

```bash
cd /root/axonetis-builder

# Worker file (NEW)
nano src/workers/agents.worker.ts
# → Lovable repo se server-snippets/agents.worker.ts ka FULL content paste karo, save (Ctrl+O, Enter, Ctrl+X)

# Routes file (OVERWRITE — already has enqueueAgentReply import + call uncommented)
nano src/routes/agents.routes.ts
# → Lovable repo se server-snippets/agents.routes.ts ka FULL content paste karo, save
```

Agar `src/workers/` directory nahi hai:
```bash
mkdir -p /root/axonetis-builder/src/workers
```

---

## Step 2 — Dependencies install

```bash
cd /root/axonetis-builder
bun add ai @openrouter/ai-sdk-provider @ai-sdk/groq ollama-ai-provider-v2 @supabase/supabase-js
```

---

## Step 3 — Env verify (sirf check, set already hai expectedly)

```bash
pm2 env 4 | grep -E "SUPABASE3_URL|SUPABASE3_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|GROQ_API_KEY|OLLAMA_BASE_URL"
```

Agar koi missing hai, ecosystem file mein add karke `pm2 restart axonetis-builder --update-env`.

Required:
- `SUPABASE3_URL`
- `SUPABASE3_SERVICE_ROLE_KEY` (service role, NEVER frontend mein)
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`
- `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)

---

## Step 4 — Build + Restart

```bash
cd /root/axonetis-builder
bun run build   # ya: npx tsc
pm2 restart axonetis-builder --update-env
pm2 logs axonetis-builder --lines 30 --nostream
```

Expected last line:
```
[axonetis-builder] listening on :PORT
```

Koi `MODULE_NOT_FOUND` ya TS error nahi hona chahiye.

---

## Step 5 — End-to-end test (Builder UI se)

1. https://founderbuilder.axonetis.com kholo
2. Unified Chat mein Jimmy ko bolo: `hello jimmy, kya tum ready ho?`
3. ~2-5 second mein assistant bubble appear ho jaayega (Realtime insert)
4. Uske turant baad Sherlock ka 2-4 line verdict ✅/⚠️/❌ aayega
5. PM2 logs mein dikhna chahiye: `[agents.worker]` activity, koi error nahi

Agar fail:
- `pm2 logs axonetis-builder --err --lines 50` se exact stack dekho
- 99% time = missing env var ya `agent_registry.routing_config` row Jimmy/Sherlock ke liye empty hai

---

## Step 6 — Done confirmation

Lovable mein wapas aake bolo: **"jimmy reply mil gaya"** ya error paste karo, agla phase (Sherlock 3-fix loop) shuru karte hain.
