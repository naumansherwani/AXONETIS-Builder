# AXONETIS Hetzner Migrations

Self-hosted Supabase 3 ke liye SQL files. **Lovable Cloud ka migration tool use NAHI karna** — yeh founder ke Hetzner instance pe manually chalti hain.

## Run karne ka tareeqa

```bash
# Hetzner server pe (Supabase 3 ke DB ke against)
psql "$SUPABASE3_DB_URL" -f hetzner-migrations/20260612000001_phase1_foundation.sql
```

Ya Supabase Studio → SQL Editor mein paste karke run.

## ⚠️ Phase 1 run karne se pehle

`20260612000001_phase1_foundation.sql` mein `handle_new_user()` function ke andar:

```sql
founder_email constant text := 'founder@hostflowai.net'; -- TODO: set real email
```

Apne actual auth email se replace karo, phir migration chalao. Pehla signup auto-admin role assign kar dega.

## Phase 1 scope (locked)

- **Roles:** `app_role` enum, `user_roles`, `has_role()`, founder auto-admin trigger
- **8 core tables:** `projects`, `project_files` (truth, hybrid TEXT + storage_path), `project_versions`, `chat_messages`, `agent_runs`, `deployments`, `ai_model_registry` (+ 6 models seeded), `mirror_sync_log`
- **7 mirror tables (hybrid):** `mirror_ai_agents`, `mirror_ai_registry`, `mirror_ai_configurations`, `mirror_industry_advisors`, `mirror_runtime_features`, `mirror_agent_capabilities`, `mirror_sync_registry`
- **Realtime publication:** `project_files`, `chat_messages`, `agent_runs`
- **RLS:** har table pe, admin-only via `has_role(auth.uid(), 'admin')`
- **GRANTs:** `authenticated` + `service_role` (bridge service_role se mirror tables likhta hai)
