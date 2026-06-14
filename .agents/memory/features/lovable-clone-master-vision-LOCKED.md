---
name: Lovable-Clone Master Vision — Founder Lock (Jun 14, 2026)
description: AXONETIS Builder = Lovable-grade AI builder. Jimmy super-coder, Sherlock super-auditor, 1-click publish→deploy, unlimited chat history, 5M char/msg, 10k attachments.
type: constraint
---

# LOCKED — Lovable-Clone Master Vision

Founder ne ek ek line padh ke bola: AXONETIS Builder ko **Lovable jaisa (ya better)** banao. Yeh hard contract hai, koi deviation nahi.

## 1. Chat Engine (UnifiedChat) — Hard Limits
- **Chat history: UNLIMITED.** Pagination + lazy load, virtual scroll. Kabhi truncate nahi.
- **Per-message text limit: 5,000,000 characters** (5 million). Textarea + DB column + validators sab is hisaab se.
- **Attachments per message: up to 10,000 files** (images, PDFs, code files, anything). Chunked upload, progress, never block UI.
- **Chat performance: butter-smooth (makhan).** Virtualized message list, no layout thrash, no blocking renders.
- **Chat width/size: same as current Builder UnifiedChat layout.** Width na badle.

## 2. Jimmy — Super-Coder Brain (Lovable-grade)
Jimmy ko Lovable jaisa (ya zyada advanced) code writer banana hai:
- **Frontend code Lovable se same-to-same ya behtar quality.** Pixel-perfect, accessible, semantic, design-system-aware.
- **Problem ka full solution likhna** — sirf snippet nahi, complete production-ready file/feature.
- **Multi-file refactor capability** — ek prompt se 10+ files coherent edit kare.
- **Business growth brain:** Jimmy ko aisa banao ke woh dusri companies ki public APIs/SDKs identify kar sake, integration likh sake, aur founder ke liye new business opportunities lay aaye (lead-gen, partnership APIs, market data scrapes — legal channels only).
- **Output format:** har response mein clear file headings (`### typescript: src/...` ya `### sql: db/...`), copy-paste ready blocks.

## 3. Sherlock — Super-Auditor Brain
- **Audit loop: max 3 auto-fix passes** per Jimmy submission. Pass 1: scan. Pass 2: propose fix. Pass 3: verify. Agar 3 ke baad bhi fail to founder ko escalate.
- **Approval = final lock.** Sherlock approve kare to woh structure production-ready.
- **8 Industries Backend Resolution Hub:** Sherlock ka primary load = Supabase 1 (HostFlow AI) ka `ai_resolution_hub` table consume kare, har advisor (Aria/Orion/Rex/Lyra/Sage/Atlas/Vega/Kai) ke backend issues khud detect kare aur fix propose kare.
- **Same intelligence tier as Jimmy** — DeepSeek R1 + Hermes 405B + GPT-OSS 120B chain (per `model-assignment-source-of-truth-LOCKED`).

## 4. Publish = Full Deploy (Lovable parity)
Founder jab sandbox preview mein **Publish** click kare:
1. Sandbox `project_files` (env=sandbox) → diff with production
2. Sherlock final audit pass
3. Promote sandbox → production atomically (`promoteSandboxToProduction` endpoint)
4. Server-side: `pm2 reload` target app + Supabase migrations apply (if any)
5. Live URL refresh — exactly like Lovable's publish button
- **Zero manual SSH.** Single button = full deploy.

## 5. Code Delivery Rules (founder copy-paste only)
- Har code block ke upar **heading**: `### typescript: <path>` ya `### sql: <path>` ya `### bash: <cmd>`
- Agar TypeScript paste corrupt ho jaaye, founder ko **bash command do jo `nano` mein file overwrite kar de** (heredoc `cat > path <<'EOF' ... EOF`). Founder manually nano nahi kholega.
- Ek phase = ek scoped delivery. Multi-step ho to numbered steps.

## 6. Memory + Storage Architecture
- Chat history: `agent_thread_messages` table, no row limit, indexed on `(thread_id, created_at)`.
- Message body: `text` column (Postgres `text` = ~1GB, 5M chars easily fits).
- Attachments: `message_attachments` table, FK to message, Supabase Storage bucket per project, 10k limit enforced at API layer + UI counter.

## 7. Enforcement
- Koi bhi future code/UI/SQL is lock ke khilaaf hua to **reject + redo**.
- Founder ki ek hi maang hai: **Lovable jaisi quality, ya behtar.**

## Cross-refs
- `unified-chat-scope-LOCKED` — Jimmy + Sherlock + Founder only
- `model-assignment-source-of-truth-LOCKED` — exact model chain
- `founder-copy-paste-only-LOCKED` — delivery format
- `backend-snippet-idempotency-and-imports-LOCKED` — SQL + import rules
