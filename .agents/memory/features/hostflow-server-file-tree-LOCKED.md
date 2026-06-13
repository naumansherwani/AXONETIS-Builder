---
name: HostFlow Server File Tree LOCKED
description: Locked file inventory of hostflow-server (Hetzner bridge + AI gateway repo) confirmed Jun 13 2026. Lovable MUST shout which repo a file belongs to before replying.
type: constraint
---

# HostFlow-Server (Bridge) Repo — LOCKED File Tree

Path on Hetzner: `/opt/hostflow-ecosystem/hostflow-server`
Confirmed by founder: **Jun 13, 2026**.

## MANDATORY RESPONSE RULE (LOCKED)

Before answering ANY message that touches backend/server/bridge/agent/AI files,
Lovable MUST first SHOUT one of these two lines:

- **"⚠️ YEH HOSTFLOW-SERVER (BRIDGE) REPO KI FILE HAI"** — if it matches the tree below.
- **"⚠️ YEH AXONETIS BUILDER (LOVABLE FRONTEND) KI FILE HAI"** — if it lives in this Lovable repo.

No exceptions. Founder is sick of mix-ups. If unsure, ASK before guessing.

## hostflow-server tree (LOCKED — do not assume anything outside this list exists)

```
./bridge/agent-registry.ts
./bridge/bridge-orchestrator.ts
./bridge/workers/checksum-sync.ts
./bridge/workers/mirror-sync.ts
./bridge/workers/realtime-sync.ts
./.env
./gateway/providers/groq.ts
./gateway/providers/models/AI Advisors.ts
./gateway/providers/models/AI Autonomous RapidPay.ts
./gateway/providers/models/AI Jimmy.ts
./gateway/providers/models/AI Sherlock.ts
./gateway/providers/openrouter.ts
./integrations/supabase1/client.ts
./integrations/supabase2/client.ts
./integrations/supabase3/client.ts
./integrations/supabase3/providers/openrouter.env
./package.json
./package-lock.json
./src/api/agents/activity.ts
./src/api/agents/router.ts
./src/api/agents/sherlock.ts
./src/index.ts
./src/routes/agents.routes.ts   ← Phase 3 mount point (founder copied here)
./src/services/activity/activity.service.ts
./src/services/agents/agent-registry.service.ts
./src/services/groq/groq.service.ts
./src/services/memory/memory.service.ts
./src/services/openrouter/openrouter.service.ts
./src/services/router/model-router.service.ts
./src/services/router/router.service.ts
./src/services/sherlock/sherlock.service.ts
./tsconfig.json
```

## Hard rules
1. Lovable NEVER edits these files. Founder pulls/edits manually on Hetzner.
2. Lovable provides copy-paste TypeScript only (per `server-endpoint-copy-paste-workflow-LOCKED`).
3. `src/index.ts` is the Express entrypoint → that is where `app.use("/api/agents", agentsRouter)` lives.
4. There are already pre-existing `src/api/agents/*.ts` and `src/services/router/*.ts` files. Before suggesting a new file, check this tree — DO NOT duplicate.
5. PM2 process name is whatever founder registered; do not assume `hostflowai-server`. Ask if unsure.
