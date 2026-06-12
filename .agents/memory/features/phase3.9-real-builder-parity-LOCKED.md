---
name: Phase 3.9 — Real Builder Parity LOCKED
description: Full blueprint for AXONETIS AI Builder to match + exceed Lovable. Every feature MUST be REAL working (no dummy), wired to Hetzner hostflowai-server + self-hosted Supabase. Composer, Publish, Domains, Cloud, Visual Edit, Versions, Code Editor, Files, Realtime preview HMR.
type: feature
---

# PHASE 3.9 — REAL BUILDER PARITY (LOCKED)

> Mission: AXONETIS AI Builder = Lovable alternative + 100× advanced.
> Every feature listed here MUST be **REAL working** — no dummy buttons, no fake modals.
> Frontend = this Lovable repo. Execution = `hostflowai-server` (Hetzner). DB = self-hosted Supabase.
> Zero duplication. Zero throwaway. Production-grade only.

---

## 0. Architecture Recap (LOCKED — do not redesign)

```
[Browser: AXONETIS Builder UI]  ←→  [Hetzner: hostflowai-server]  ←→  [Self-hosted Supabase x3]
        (this repo)                  (Jimmy, Sherlock, Advisors,        (truth: project_files,
                                      OpenRouter+Groq, bridge,           agents, deploys, domains)
                                      checksum sync, deploy runner)
        ↑                                       ↑
        └────── postMessage iframe ──── [Preview sandboxes]
                                        hostflowai.net / rapidpay / aiaxonetis
```

- Frontend NEVER calls OpenRouter/Groq directly.
- Frontend NEVER writes to Supabase as service_role.
- All AI/build/deploy goes through `hostflowai-server` REST + SSE.
- Realtime HMR: Supabase Realtime channel `project_files:{projectId}` → preview iframe reloads patched modules.

---

## 1. CHAT COMPOSER (REAL — AI Elements)

Match Lovable composer 1:1:

| Control | Behavior | Backend |
|---|---|---|
| Textarea (auto-grow, ⌘/Ctrl+Enter to send) | AI Elements `PromptInput` + `PromptInputTextarea` | — |
| **Send (↑ arrow)** | Submits prompt; shows shimmer "Thinking…"; streams tokens | `POST /api/agents/:slug/chat` (SSE) |
| **Stop (■)** | Visible only while `status==="streaming"`; aborts stream | `AbortController` + `POST /api/agents/stream/:id/cancel` |
| **Mic (🎙)** | Hold-to-talk; Whisper transcription; inserts text | `POST /api/voice/transcribe` (multipart audio) |
| **Attach (📎)** | Images, files, screenshots; thumbnails in composer | `POST /api/uploads` → returns signed URL; attached as message parts |
| **Model selector** | Jimmy / Sherlock / Advisor / Auto-Router | sets `agent_slug` in request |
| **@-mention files** | Autocomplete project files; inserted as context | reads from `project_files` mirror |
| **Slash commands** | `/fix`, `/scan`, `/deploy`, `/rollback`, `/explain` | maps to agent endpoints |
| **Queue indicator** | Shows queued prompts when streaming | local state + server queue id |

Implementation: install `bun x ai-elements@latest add conversation message prompt-input shimmer tool` and compose. No custom bubbles unless AI Elements lacks it.

---

## 2. PUBLISH MODAL (REAL — Lovable parity)

Trigger: top-bar **Publish** button. Modal shows:

- **Live URL** with copy button (`{project}.aiaxonetis.hostflowai.net`)
- **Last published**: timestamp + commit short SHA
- **Status badge**: Up-to-date / Changes pending / Building / Failed
- **Update button**: triggers new deploy (frontend changes only)
- **Visibility**: Public / Private / Workspace-only (radio)
- **Visitor count** (last 24h / 7d / 30d) — from `deploy_analytics`
- **Review security** link → opens security scan panel
- **Edit settings** → opens project settings drawer
- **Connect custom domain** → opens Domains panel
- **Share preview link** (7-day signed URL, no login)
- **Unpublish** (destructive, confirm dialog)

Backend endpoints (Hetzner):
```
POST   /api/deploys                  { projectId } → { deployId, status }
GET    /api/deploys/:id              SSE build logs
GET    /api/projects/:id/publish     current publish state
PATCH  /api/projects/:id/visibility  { visibility }
POST   /api/projects/:id/share-link  → { url, expiresAt }
DELETE /api/projects/:id/publish     unpublish
```

DB tables (Supabase 3):
```sql
deploys           (id, project_id, commit_sha, status, logs_url, started_at, finished_at, url)
project_publish   (project_id PK, visibility, primary_domain, last_deploy_id, updated_at)
share_links       (id, project_id, token, expires_at, created_by)
```

---

## 3. DOMAINS PANEL (REAL)

Route: `/builder/settings/domains`

Sections:
1. **Lovable-style URL** — editable slug `{slug}.aiaxonetis.hostflowai.net`; uniqueness check.
2. **Custom domains list** — status pills (Verifying / Active / Offline / Failed); Configure / Remove actions.
3. **Connect existing domain** — input domain → shows A `185.158.133.1` + TXT records → "Verify now" button (polls DNS).
4. **Buy new domain** — search + register via founder's registrar API (stub Phase 4.1).
5. **DNS records manager** (for purchased) — add/edit/delete A/AAAA/CNAME/MX/TXT/SRV.
6. **SSL status** — Let's Encrypt auto-provision; manual retry.
7. **Primary domain** selector — others redirect.

Backend:
```
GET    /api/domains?projectId=...
POST   /api/domains/connect          { projectId, domain, useProxy }
GET    /api/domains/:id/verify       polls DNS, issues cert
DELETE /api/domains/:id
PATCH  /api/domains/:id/primary
GET    /api/domains/:id/dns
POST   /api/domains/:id/dns          (purchased only)
```

DB:
```sql
domains      (id, project_id, domain, status, is_primary, ssl_status, txt_token, created_at, verified_at)
dns_records  (id, domain_id, type, name, value, ttl, priority)
```

---

## 4. CLOUD PANEL (REAL — Lovable Cloud parity)

Single drawer panel grouping self-hosted Supabase features:

| Tab | What it shows | Backend |
|---|---|---|
| **Database** | Table list, row count, SQL editor, run query (read-only by default; write needs founder confirm) | `POST /api/cloud/sql/run` |
| **Auth** | Users list, providers toggle (Email, Google, Apple, GitHub), email templates | `/api/cloud/auth/*` |
| **Storage** | Buckets, files, signed URLs, public toggle | `/api/cloud/storage/*` |
| **Functions** | List server fns, last invoked, logs, redeploy | `/api/cloud/functions/*` |
| **Secrets** | List + add + rotate (masked) | `/api/cloud/secrets/*` |
| **Logs** | Live tail (SSE) — API, DB, Auth, Functions | `/api/cloud/logs/stream` |
| **Analytics** | Requests/min, error rate, p95 latency | `/api/cloud/analytics` |

All write ops require founder JWT + role check `has_role(uid,'admin')`.

---

## 5. CODE EDITOR + FILES PANEL (REAL)

- **Monaco editor** in right pane when **Code** mode active (toggles iframe ↔ editor).
- File tree from `project_files` mirror table (left side).
- Tabs, dirty indicator, autosave on blur.
- On save: `PATCH /api/files` → writes to Hetzner git repo + updates `project_files` row → Realtime broadcast → preview HMR.
- **Diff preview** before AI applies changes (Jimmy proposes patch, founder approves).
- Find/Replace across files, Go-to-definition (LSP via server).
- **Visual Edit mode**: click any element in preview → highlights in code → inline prompt to modify (postMessage bridge).

---

## 6. VERSIONS / HISTORY (REAL)

- Every successful Jimmy build = git commit on Hetzner.
- Panel shows commit list with: SHA, message (AI-generated), author (agent slug), diff stats, screenshot thumbnail.
- **Restore** → `POST /api/versions/:sha/restore` → resets working tree, redeploys.
- **Compare** two versions side-by-side.
- **Branches**: main / experiments; PR-style merge with Sherlock review.

---

## 7. KILLER FEATURES (beat Lovable)

These are the locked differentiators from master blueprint:

1. **Sherlock Auto-Fix Loop** — max 3 iterations on build error; shows progress in chat.
2. **Multi-Agent Parallel** — Jimmy builds UI while advisor writes copy while Sherlock writes tests.
3. **Cost Meter** — every prompt shows tokens + $ cost (live).
4. **Voice Deploy** — "Sherwani, deploy to production" → confirm dialog → ships.
5. **Rollback in 1 click** — from versions panel or `/rollback` slash command.
6. **Diff Preview** — never apply AI changes without founder approval modal.
7. **Founder Sandbox** — separate env to test risky prompts safely.
8. **Stress / Revenue / Explainability Layers** — Intelligence dashboards.
9. **Global Router (Llama 3.3 70B)** — picks cheapest capable model per task.
10. **Realtime HMR preview** — no full reload; module-level patching.

---

## 8. POSTMESSAGE BRIDGE CONTRACT (REAL)

Builder ↔ Preview iframe:

```ts
// Builder → Preview
{ type: 'axonetis:navigate', path: '/dashboard' }
{ type: 'axonetis:reload' }
{ type: 'axonetis:hmr-patch', moduleId, code }
{ type: 'axonetis:visual-edit:enable' }
{ type: 'axonetis:visual-edit:highlight', selector }

// Preview → Builder
{ type: 'axonetis:route-change', path }
{ type: 'axonetis:runtime-error', message, stack, file, line }
{ type: 'axonetis:console', level, args }
{ type: 'axonetis:network', method, url, status, duration }
{ type: 'axonetis:visual-edit:click', selector, rect, sourceFile, sourceLine }
{ type: 'axonetis:bridge-ready', projectId, version }
```

Origin whitelist enforced. Errors auto-stream into chat as Sherlock context.

---

## 9. SUPABASE TABLES ADDED IN PHASE 3.9

(Migration: `db/migrations/2026_06_13_phase3_9_builder_parity.sql`)

```
deploys, project_publish, share_links,
domains, dns_records,
project_files (id, project_id, path, content, sha, updated_by, updated_at),
file_versions (id, file_id, sha, content, commit_id, created_at),
commits (id, project_id, sha, message, agent_slug, parent_sha, stats, screenshot_url, created_at),
ai_costs (id, user_id, agent_slug, prompt_tokens, completion_tokens, model, cost_usd, created_at),
visitor_events (id, project_id, path, ua, country, created_at)
```

All with GRANT + RLS scoped to `user_id = auth.uid()` or `has_role(auth.uid(),'admin')`.

---

## 10. HETZNER SERVER ENDPOINTS — FULL MAP

```
# Agents (Phase 3)
GET    /api/agents
POST   /api/agents/:slug/chat              (SSE stream)
POST   /api/agents/stream/:id/cancel
POST   /api/agents/sherlock/scan
GET    /api/agents/threads
GET    /api/agents/threads/:id/messages
GET/POST /api/agents/:slug/memory
GET    /api/agents/activity                (SSE)
POST   /api/agents/router/route

# Voice + Uploads (3.9)
POST   /api/voice/transcribe
POST   /api/uploads

# Files + Versions (3.9)
GET    /api/files?projectId=
GET    /api/files/:id
PATCH  /api/files/:id
POST   /api/files                          (create)
DELETE /api/files/:id
GET    /api/versions?projectId=
POST   /api/versions/:sha/restore
GET    /api/versions/compare?a=&b=

# Deploys + Publish (3.9)
POST   /api/deploys
GET    /api/deploys/:id                    (SSE logs)
GET    /api/projects/:id/publish
PATCH  /api/projects/:id/visibility
POST   /api/projects/:id/share-link
DELETE /api/projects/:id/publish

# Domains (3.9)
GET    /api/domains
POST   /api/domains/connect
GET    /api/domains/:id/verify
DELETE /api/domains/:id
PATCH  /api/domains/:id/primary
GET/POST /api/domains/:id/dns

# Cloud (3.9)
POST   /api/cloud/sql/run
GET    /api/cloud/auth/users
PATCH  /api/cloud/auth/providers
GET    /api/cloud/storage/buckets
POST   /api/cloud/storage/upload
GET    /api/cloud/functions
GET    /api/cloud/secrets
POST   /api/cloud/secrets
GET    /api/cloud/logs/stream              (SSE)
GET    /api/cloud/analytics
```

Auth: every endpoint validates Supabase JWT; privileged endpoints check `has_role(uid,'admin')`.

---

## 11. BUILD ORDER (3.9.x sub-phases)

| Sub | Scope | Repo |
|---|---|---|
| **3.9.1** | Real chat composer (Send/Stop/Mic/Attach, AI Elements) | Lovable |
| **3.9.2** | Publish modal + visibility + share link UI | Lovable |
| **3.9.3** | Domains panel (connect existing + verify polling) | Lovable |
| **3.9.4** | Cloud panel (Database + Auth + Storage + Logs tabs) | Lovable |
| **3.9.5** | Versions panel + diff preview modal | Lovable |
| **3.9.6** | Monaco code editor + Files tree + Visual Edit bridge | Lovable |
| **3.9.7** | Cost meter + Router UI + slash commands | Lovable |
| **3.9.8** | SQL migration `2026_06_13_phase3_9_builder_parity.sql` | Hetzner (founder runs) |
| **3.9.9** | Server endpoints scaffolding doc → founder implements | Hetzner |

After each sub-phase: founder says **"ruko"** → `git pull` → review → **"agla"** → next.

---

## 12. HARD RULES (NEVER VIOLATE)

1. No dummy buttons. Every control wires to a real endpoint (stub returns `501` if server not ready, UI shows "Server endpoint pending").
2. No duplicate components/tables/routes — search first, extend if exists.
3. No service_role key in frontend. Ever.
4. No AI provider SDKs in frontend. Only `fetch` to Hetzner.
5. No SQL run from Lovable until founder confirms server ready for that migration.
6. AI Elements first for chat surface; custom only where AI Elements lacks.
7. Every endpoint authenticated; admin endpoints role-checked.
8. Every table: GRANT + RLS + policy in same migration.
9. Realtime HMR over full reload wherever possible.
10. Diff preview before any AI-applied code change.

---

**LOCKED Jun 12 2026. This is the single source of truth for Phase 3.9. Do not deviate.**
