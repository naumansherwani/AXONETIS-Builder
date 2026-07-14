---
name: Phase 3.10 Master Roadmap LOCKED
description: AXONETIS Complete Audit + Phase 3.10 feature tarteeb (12-Tool Registry + Sub-Agents + Checkpoint + Memory + Planning Tree + Recovery + Learning + Stage UI + Dependency Graph). Turning point phase — Jimmy runtime nervous system.
type: feature
---

# AXONETIS Phase 3.10 — MASTER ROADMAP (LOCKED Jul 14 2026)

Turning point: Jimmy chat interface → interactive AI software engineering runtime.
Zero dummy. Zero duplicate. Extend existing files, never rebuild.

---

## PART A — Complete Audit Snapshot (Phase 3.9.x baseline)

### Panels shipped (22 total, 8 mandatory ✅)
| # | Blueprint | File | API | Status |
|---|---|---|---|---|
| 1 | Files | FilesPanel.tsx | files-api → /rpc/files.* | ✅ REAL |
| 2 | Cloud→DB | DatabasePanel.tsx | /rpc/cloud.sql.run | ✅ REAL |
| 3 | Cloud→Storage | StoragePanel.tsx | /rpc/storage.* | ✅ REAL |
| 4 | Cloud→Secrets | SecretsPanel.tsx | /rpc/secrets.* | ✅ REAL |
| 5 | Domains | PublishModal (3.9.3) | /rpc/publish.* LIVE | ✅ REAL |
| 6 | Versions | VersionsPanel.tsx | /rpc/versions.* | ✅ REAL |
| 7 | Tools | ToolsPanel.tsx | /rpc/tools.* | ✅ REAL |
| 8 | Costs | CostsPanel.tsx | /rpc/costs.get | ✅ REAL |
| 9 | Security | SecurityPanel.tsx | /rpc/cloud.security.scan | ✅ REAL |
| 10 | Logs | LogsPanel.tsx | SSE /rpc/cloud.logs.stream | ✅ REAL |
| 11 | Analytics | AnalyticsPanel.tsx | /rpc/cloud.analytics | ✅ REAL |
| Bonus | Agents/Activity/CommandCenter/DualBrain/Deploy/Marketplace/Memory/Projects/Runtime/Code | 10 panels | wired | ✅ |

Total: 3,031 lines panel code + 13 typed API clients. Grep audit: ZERO TODO/dummy/mock/lorem/Coming soon.

### Gaps vs Lovable parity
- Lovable "More" pill: functional ✅, visual different (icon rail + drawer instead of floating pill).
- Domains: modal-bound; missing standalone `/settings/domains` route + "Buy new domain" button.
- Payments/Connectors/SEO: not shipped (Phase 9/11 scope).

### Cloud = 100% Hetzner self-hosted. No Lovable Cloud, no external Supabase, no Cloudflare.

---

## PART B — Phase 3.10 Feature Tarteeb (LOCKED order)

### 3.10.1 — ToolCallBubble Extend + useAgentStream + Abort
- EXTEND `src/components/builder/ToolCallBubble.tsx` (NO duplicate).
- Add animated progress bar 0→100%, Cancel button, category top-border color (code/search/db/http/shell/ai).
- NEW `src/hooks/useAgentStream.ts` — wraps Realtime + SSE `/api/agents/:slug/chat/stream`, returns `{ messages, activeTools, abort(), cost }`.
- Server: `POST /rpc/tools.abort { tool_call_id }` → SIGTERM Rust worker child.

### 3.10.2 — DiffApprovalModal Extend
- EXTEND `src/components/builder/MonacoDiffModal.tsx` (NO new modal file).
- Add Approve/Reject/Preview buttons + Sherlock verdict badge (top strip).
- Server: `POST /rpc/diffs.approve { diff_id }`, `POST /rpc/diffs.reject { diff_id, reason? }`.
- Status writes to Supabase 3 → Realtime pushes UI.

### 3.10.3 — Self-Verify Loop UI
- NEW `src/components/builder/SelfVerifyLoop.tsx`.
- Attempts 1/3, 2/3, 3/3 tracker; expandable `<thought>` + Sherlock verdict pill.
- Data: `agent_thread_messages.parts[].type === "verification"` (Rust runtime emits).

### 3.10.4 — SubAgentTimeline + Dependency Graph
- NEW `src/components/builder/SubAgentTimeline.tsx`.
- Reads `agent_activity` filtered by `parent_message_id` (spawn_subagent calls).
- Max 5 parallel workers, model badges color-coded:
  - Qwen3 Coder 480B → cyan · Hermes 3 → violet · Kimi K2 → amber · GLM-4.6 → emerald · DeepSeek V3 → rose.
- **NEW: Dependency Graph view** (Jimmy → Coder → Reviewer → Database → Deploy) — visual DAG next to timeline.
- Registry adds `spawn_subagent` tool.

### 3.10.5 — StatusBar Cost Meter + Monaco Diagnostics
- EXTEND `src/components/builder/StatusBar.tsx` — session cost accumulator + daily budget threshold bar (green <$10, amber $10-50, red >$50).
- Threshold from `founder_settings.daily_budget_usd` (Supabase 3).
- Server: `GET /rpc/founder/budget`.
- EXTEND `CodePanel.tsx` — Monaco TS worker red squigglies + hover "Auto-fix" chip.
- Server: `POST /rpc/code.autofix { path, diagnostics[] }` → Sherlock patch.

### 3.10.6 — Checkpoint Engine (NEW LOCK)
- Har tool call ke baad automatic filesystem snapshot (git commit or content hash).
- Rollback button per checkpoint in Versions panel.
- Server: `POST /rpc/checkpoints.create`, `POST /rpc/checkpoints.rollback { checkpoint_id }`.
- Supabase 3 table `checkpoints` (id, thread_id, tool_call_id, files_snapshot, created_at).

### 3.10.7 — Workspace Memory (NEW LOCK)
- Jimmy remembers: "yeh file kal modify ki thi", "yeh function risky hai", "yeh dependency break hogi".
- Supabase 3 `workspace_memory` table (project_id, file_path, note_type, note, risk_score, updated_at).
- pgvector embeddings for semantic recall.
- Injected into Jimmy's system prompt via `/rpc/memory.recall`.

### 3.10.8 — Planning Tree (NEW LOCK)
- Execution se pehle Jimmy tree banaye: Goal → Task A → Task B → Task C → Verification.
- UI: collapsible tree above chat, user confidence booster.
- New part type: `{ type: "plan_tree", nodes: [...], status: "draft|approved|executing|done" }`.
- User can Approve/Edit before Jimmy executes.

### 3.10.9 — Recovery Engine (NEW LOCK)
- Deploy fail → Jimmy auto rollback → retry → verify → report.
- Enterprise loop. Wired to Checkpoint Engine (3.10.6).
- Server: `POST /rpc/recovery.trigger { failure_id }`.

### 3.10.10 — Learning Store (NEW LOCK)
- Sherlock har failed build se knowledge extract kare → Supabase 3 `learning_store` (failure_pattern, root_cause, fix, embedding).
- Next build pe similarity search inject to Jimmy context.
- Compounds over time.

### 3.10.11 — Animated Stage UI (NEW LOCK)
- Jimmy reply ke andar stage pills: **Thinking → Planning → Executing → Verifying → Completed**.
- Animated transitions (framer-motion), premium feel.
- Driven by Rust runtime state machine emitted via SSE.

---

## PART C — Rust Runtime Contract (server side, founder pastes)

New `agent_thread_messages.parts[]` types Rust worker emits:
```json
{"type":"tool_call","id","name","args","status","output?","cost_usd?","duration_ms?","progress?":0-100,"abort_token?"}
{"type":"diff","diff_id","path","old","new","language?","sherlock_verdict?":"pass|fail","sherlock_reason?"}
{"type":"verification","attempt":1,"max_attempts":3,"reasoning","verdict":"pass|fail|retry","diffs_count"}
{"type":"subagent","worker_id","parent_msg_id","task","model","status"}
{"type":"plan_tree","nodes":[...],"status"}
{"type":"stage","name":"thinking|planning|executing|verifying|completed"}
{"type":"checkpoint","checkpoint_id","files_count"}
```

New RPC endpoints:
- `POST /rpc/diffs.approve|reject`
- `POST /rpc/tools.abort`
- `GET  /rpc/founder/budget`
- `POST /rpc/code.autofix`
- `POST /rpc/checkpoints.create|rollback`
- `POST /rpc/memory.recall|store`
- `POST /rpc/recovery.trigger`
- `POST /rpc/learning.record|search`

---

## PART D — Jimmy "Super Advanced" 5 Keys (Claude/Lovable parity)
1. Real Rust agent loop — plan→tool→observe→verify→iterate, `stepCountIs(50)`.
2. Sherlock verifier separate model call per diff (GLM-4.6/DeepSeek) — auto pass/fail before founder sees Approve.
3. Global Router (Phase 3.9.7 shipped) — cheapest model per prompt.
4. Tool registry `needsApproval: true` for write_file/run_sql/delete.
5. `spawn_subagent` tool — 5 parallel workers max.

---

## PART E — NO DUPLICATE Enforcement
❌ NAYA `src/components/chat/ToolCallBubble.tsx` — FORBIDDEN. Extend `builder/ToolCallBubble.tsx`.
❌ NAYA `DiffApprovalModal.tsx` — FORBIDDEN. Extend `MonacoDiffModal.tsx`.
✅ Naye files sirf: `SelfVerifyLoop.tsx`, `SubAgentTimeline.tsx`, `useAgentStream.ts`, planning-tree/checkpoint/memory/recovery/learning/stage components (equivalents nahi hain).

## PART F — Delivery workflow
Chunks 3.10.1 → 3.10.11 ek-ek. Har chunk ke baad founder git pull → test → "agla" bole. No batching, no mixing.
