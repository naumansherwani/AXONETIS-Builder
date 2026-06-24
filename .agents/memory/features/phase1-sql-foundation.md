---
name: Phase 1 SQL Foundation
description: Hetzner Supabase 3 ke liye Phase 1 migration — 8 core + 7 hybrid mirror tables + roles + 6 seeded models + 11 agent identities. Founder emails locked.
type: feature
---

# Phase 1 SQL — Supabase 3 Foundation (LOCKED)

**Files:**
- `hetzner-migrations/20260612000001_phase1_foundation.sql` ✅ run Jun 12 2026
- `hetzner-migrations/20260612000002_add_builder_admin_email.sql` — adds `hostflowaibuilder@gmail.com` as 3rd founder/admin

**Founder/admin emails (LOCKED, all 3):**
1. naumansherwani@nexatect.com
2. naumankhansherwani@gmail.com
3. hostflowaibuilder@gmail.com

**Repos LOCKED:**
- `naumansherwani/founder-ai-builder` → AXONETIS (Lovable, frontend + hetzner-migrations/)
- `naumansherwani/hostflowai-server` → bridge + 3-Supabase server (founder manual, NEVER touch)
**Run manually on Hetzner** (NOT via Lovable Cloud migration tool — different instance).

## What it creates
- `app_role` enum (admin/founder/service) + `user_roles` + `has_role()` security-definer
- `handle_new_user()` trigger on `auth.users` — auto-admin on founder email signup (placeholder email, founder must edit before running)
- **8 core tables:** `projects`, `project_files` (hybrid TEXT + storage_path truth table), `project_versions`, `chat_messages`, `agent_runs`, `deployments`, `ai_model_registry` (+ 6 seeded models), `mirror_sync_log`
- **7 hybrid mirror tables:** `mirror_ai_agents`, `mirror_ai_registry`, `mirror_ai_configurations`, `mirror_industry_advisors`, `mirror_runtime_features`, `mirror_agent_capabilities`, `mirror_sync_registry` — each has typed indexable cols + payload JSONB, written by bridge service_role only
- Realtime publication: `project_files`, `chat_messages`, `agent_runs`
- RLS on all tables, admin-only via `has_role(auth.uid(), 'admin')`
- GRANTs: authenticated (read where appropriate) + service_role (bridge writes)

## Seeded AI models (6)
Hermes 3 405B, Qwen3 Coder 480B, DeepSeek R1, Llama 3.3 70B (OpenRouter router) — primary
Llama 3.3 70B Versatile, GPT-OSS 120B (Groq) — failover

## DO NOT
- Use Lovable Cloud migration tool for this
- Create duplicate bridge/AI/orchestration tables
- Write to mirror_ tables from frontend — only bridge service_role writes
