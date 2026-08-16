# INSTALL — A (real deploy) + B (bridge handshake) + C (memory/WHY write path)

## 1. SQL (Supabase 3 — founder DB)

```sql
create table if not exists public.agent_explanations (
  message_id text primary key,
  project_slug text not null,
  why text, model text, model_reason text,
  tokens_in int, tokens_out int, cost_usd numeric,
  chain jsonb not null default '[]', tools jsonb not null default '[]',
  memory_refs jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table if not exists public.workspace_memory (
  id uuid primary key default gen_random_uuid(),
  project_slug text not null, message_id text,
  title text not null, content text not null,
  kind text not null default 'episodic', importance int not null default 3,
  created_at timestamptz not null default now()
);
create index if not exists workspace_memory_proj_idx on public.workspace_memory(project_slug, created_at desc);
alter table public.agent_explanations enable row level security;
alter table public.workspace_memory enable row level security;
grant all on public.agent_explanations, public.workspace_memory to service_role;
```

## 2. Bridge (8090) — mount naye routers, NO DUPLICATE

```bash
cd /opt/hostflow-ecosystem/hostflow-server && \
cp /var/www/axonetis/server-snippets/deploy.routes.ts  src/routes/deploy.routes.ts && \
cp /var/www/axonetis/server-snippets/explain.routes.ts src/routes/explain.routes.ts && \
grep -q 'deploy.routes.js' src/index.ts || sed -i 's#^const app = express();#import deployRouter from "./routes/deploy.routes.js";\nimport explainRouter from "./routes/explain.routes.js";\nconst app = express();#' src/index.ts && \
grep -q '"/rpc", deployRouter' src/index.ts || sed -i 's#app.use("/rpc", rpcRouter);#app.use("/rpc", rpcRouter);\napp.use("/rpc", deployRouter);\napp.use("/rpc", explainRouter);#' src/index.ts && \
bun run build && pm2 restart hostflow-server --update-env && sleep 3 && \
curl -sS -o /dev/null -w 'explain.get:%{http_code}\n' 'http://127.0.0.1:8090/rpc/explain.get?projectId=founderbuilder&messageId=x' && \
curl -sS -o /dev/null -w 'memory.list:%{http_code}\n' 'http://127.0.0.1:8090/rpc/memory.list?projectId=founderbuilder' && \
curl -sS -o /dev/null -w 'publish.run:%{http_code}\n' -X POST http://127.0.0.1:8090/rpc/publish.run -H 'content-type: application/json' -d '{"projectId":"__none__"}'
```

Expected: `explain.get:200`, `memory.list:200`, `publish.run:200` (SSE, unknown project → error frame).

`deploy.routes.ts` env: `AXONETIS_DB_URL`, `SUPABASE1_DB_URL`, `SUPABASE2_DB_URL` (migrations optional — na ho to skip hota hai). Production mein sirf `pm2 restart <existing-process>` use hota hai; `pm2 update` kabhi nahi.

## 3. Preview bridge (B) — har preview app mein inject

`server-snippets/preview-visual-edit-bridge.js` (dono blocks) ko preview app ke `</body>` se pehle load karo. Wo `bridge:handshake`/`bridge:ping` ka jawab `bridge:ready`/`bridge:pong` se deta hai → Builder chip `NO-SIGNAL` se `CONNECTED` ho jata hai, plus route:change / dom:click / runtime:error live aate hain.
