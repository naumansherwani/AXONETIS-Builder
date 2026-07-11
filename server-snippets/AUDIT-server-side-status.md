# Server-Side Audit — Phases 3.9.3 → 3.9.5

Founder rule: **frontend + backend saath complete honge**, phir next phase.

---

## ✅ Phase 3.9.3 — Publish Modal

**Frontend:** `src/lib/publish-api.ts`, `src/components/builder/PublishModal.tsx`

**Server-side deliverables (already pushed to `server-snippets/`):**
| Endpoint | File | Status |
|---|---|---|
| `POST /rpc/publish.state` | `rpc.routes.ts` | ✅ delivered |
| `POST /rpc/publish.setVisibility` | `rpc.routes.ts` | ✅ delivered |
| `POST /rpc/publish.share` (7-day expiry) | `rpc.routes.ts` | ✅ delivered |
| `POST /rpc/publish.unpublish` | `rpc.routes.ts` | ✅ delivered |
| `GET  /rpc/deploys.status` (SSE) | `rpc.routes.ts` | ✅ delivered |
| `POST /rpc/visitor.count` | `rpc.routes.ts` | ✅ delivered |

**DB tables:** `publish_settings`, `publish_share_links`, `visitor_events` → in `hetzner-migrations/20260711000001_*.sql` ✅

---

## ✅ Phase 3.9.4 — Power Tools

**Frontend:** `src/lib/power-tools-api.ts`, `src/lib/rrweb-recorder.ts`, DatabasePanel/VersionsPanel updates

**Server-side deliverables (already pushed):**
| Endpoint | Purpose | Status |
|---|---|---|
| `POST /rpc/sql.validate` | Sherlock dry-run + risk verdict | ✅ delivered |
| `POST /rpc/caddy.attach` | Custom domain SSL issue | ✅ delivered |
| `POST /rpc/caddy.revoke` | Domain removal | ✅ delivered |
| `GET  /rpc/caddy.list` | Domain list + SSL state | ✅ delivered |
| `POST /rpc/timetravel.checkout` | git checkout commit → preview | ✅ delivered |
| `POST /rpc/rrweb.push` | Batch session events ingest | ✅ delivered |
| `GET  /rpc/rrweb.list` | Session index | ✅ delivered |
| `GET  /rpc/rrweb.get` | Session events replay | ✅ delivered |

**DB tables:** `custom_domains`, `rrweb_sessions`, `rrweb_events` → in same migration ✅

---

## ✅ Phase 3.9.5 — Composer Polish

**Frontend:** Stop button (AbortController), Visual Edit mode, Monaco diff modal, shimmer.

**Server-side deliverables:**
| Item | File | Status |
|---|---|---|
| Preview iframe bridge (`visual:edit:toggle` listener + `visual:edit:pick` emit) | `server-snippets/preview-visual-edit-bridge.js` | ✅ delivered |
| Abort support on `/rpc/agents.chat` (client sends `AbortController.signal` → server must respect `req.signal`) | `agents.routes.ts` (already streams; verify AbortSignal wired on Hetzner) | ⚠️ **verify** |
| Diff review = 100% client-side (Monaco) | — | ✅ no server work |

**Only ⚠️ item:** confirm `agents.routes.ts` handler propagates `request.signal` into the streamText call so Stop button actually cancels the OpenRouter/Groq generation. If not, add:

```ts
// inside POST /rpc/agents.chat handler
const controller = new AbortController();
request.signal.addEventListener('abort', () => controller.abort());
const result = streamText({ ..., abortSignal: controller.signal });
```

---

## 📋 Deployment Checklist (Hetzner)

```bash
cd /var/www/axonetis && \
git pull && \
psql "$SUPABASE_DB_URL" -f hetzner-migrations/20260711000001_phase_393_394_publish_power_tools.sql && \
bun install && bun run build && \
pm2 restart axonetis-builder && \
pm2 logs axonetis-builder --lines 30 --nostream
```

Verify each endpoint:
```bash
curl -sX POST https://aiaxonetis.hostflowai.net/rpc/publish.state -H 'content-type: application/json' -d '{"projectId":"test"}'
curl -sX POST https://aiaxonetis.hostflowai.net/rpc/sql.validate -H 'content-type: application/json' -d '{"sql":"select 1"}'
curl -sN https://aiaxonetis.hostflowai.net/rpc/deploys.status?projectId=test
```

---

## 🚦 Going Forward — New Rule (LOCKED)

Founder ka final warning:
1. **Har phase mein frontend + server-snippets + migration ek hi turn mein deliver honge.**
2. Push hone ke baad founder Hetzner pe `git pull` karega — dono repos ek saath sync.
3. Agar server endpoint zaroori hai to frontend "pending fallback" placeholder acceptable, lekin `server-snippets/` mein complete code hona **mandatory** hai.
4. No duplicate. No half-work. No "server side pending" surprise.

**Recent phases audit: 3.9.3 ✅, 3.9.4 ✅, 3.9.5 ✅ (Stop abort signal verify only).**
Ready for **3.9.6 Marketplace + Voice Deploy** — frontend + server saath deliver hoga.
