---
name: Phase 3.10 — Jimmy Chatbox Supabase 3 Wiring + Repo Split LOCKED
description: Founder Command Center dashboard mein Jimmy + Sherlock + 8 advisor chatboxes already maujood hain (currently wired to Supabase 1). Phase 3.10 mein un sab ko Supabase 3 SSE streaming pe migrate karna hai — kyunki Supabase 3 = AI ka ghar. GitHub se connect karke saara AI CRM code + UI Supabase 3 pe banega, Supabase 1 pe NAHI. Repo split + dogfooding loop locked.
type: feature
---

# Phase 3.10 — Jimmy Chatbox Supabase 3 Wiring + Repo Split (LOCKED)

## 1. Current State (founder confirmed)
- Founder Command Center dashboard mein **Jimmy ki advanced chatbox already exists** — currently wired to **Supabase 1** (HostFlow).
- **Sherlock ki bhi chatbox** maujood hai same dashboard mein.
- Baaqi **8 AI industry advisors** ke chatboxes apni-apni industry surfaces mein maujood hain.
- Yeh sab chat infra duplicate NAHI banegi — sirf **rewire** hogi.

## 2. Migration Target (LOCKED)
- **Sab AI chatboxes (Jimmy + Sherlock + 8 advisors) ko Supabase 3 SSE streaming pe move karo.**
- Reason: Supabase 3 = **AI ka ghar** (ai_agent_identities, agent_threads, agent_thread_messages, agent_memory, agent_activity already live).
- Supabase 1 sirf HostFlow business data ke liye reh jayega. AI traffic Supabase 1 se nikal jayega.
- SSE endpoint: `/api/agents/:slug/chat` (stream) on hostflowai-server bridge → reads/writes Supabase 3.
- Frontend chatbox UI same rahegi (no duplicate component) — sirf transport layer Supabase 3 pe point karega.

## 3. Repo Split (LOCKED — Production-Grade Separation)

### Founder Account = `hostflowai-server` repo (Jimmy ka ghar)
- Jimmy chatbox + **GitHub token already wired** in founder account.
- **Trojan Horse CRM (Phase 9)** wahin banega → `crm.aiaxonetis.hostflowai.net`.
- Salesforce mirror tables → **Supabase 2**.
- Jimmy khud apna CRM code commit karega **via GitHub token** = self-building loop.
- **Real dogfooding**: Jimmy apne aap ko use karke CRM banayega → proof ke woh Claude-tier hai.

### This Project = `founder-ai-builder` repo (AXONETIS Builder, Lovable — Builder UI ka ghar)
- **Sirf Builder frontend kaam** yahan hota hai: Phase 3.10 UI = tool stream, diff modal, cost meter, sub-agent timeline, mem editor.
- **Server snippets yahin se generate** honge → founder copy-paste karega `hostflowai-server` pe (per founder-copy-paste-only LOCKED rule).
- **CRM ka koi UI/code yahan NAHI aayega.** Zero cross-contamination.

## 4. Faida (Why This Split is Right)
1. **No duplicate** — CRM Jimmy ke account mein, Builder yahan. Kabhi cross-contamination nahi.
2. **Self-hosting proof** — Jimmy apna CRM khud bana sakta hai → founder ke paas demo-ready product.
3. **Token security** — GitHub token sirf founder account mein. Lovable repo mein leak ka risk = zero.
4. **Natural phase order** locked.

## 5. Phase Order (LOCKED)
1. **Phase 3.10 ship yahan** → Builder UI (tool stream + diff modal + cost meter + sub-agent timeline + mem editor) + server snippets for real agent tool loop + **SSE wiring for Jimmy/Sherlock/8 advisors chatboxes ko Supabase 3 pe point karna**.
2. Founder snippets paste kare `hostflowai-server` pe → Jimmy live on Supabase 3 SSE.
3. Phir Jimmy ko bolo: "Apne account mein CRM bana" → **Phase 9 Trojan Horse Jimmy khud build kare** (founder account, Supabase 2 mirror).
4. **Phase 10 features** (rrweb, marketplace, voice, browser-use, multiplayer) wapis yahan Builder UI mein.

## 6. Hard Rules (NEVER violate)
- ❌ Jimmy/Sherlock/advisor chat ka **koi naya UI Lovable mein NAHI banega** — existing chatboxes ko rewire karo only.
- ❌ AI tables Supabase 1 mein **NAHI** banegi — sab Supabase 3 mein.
- ❌ CRM code Lovable repo mein **NAHI** aayega — Jimmy khud apne account mein banayega via GitHub token.
- ❌ GitHub token Lovable repo mein **NEVER** — sirf founder account.
- ✅ Builder UI (Phase 3.10) yahan + server snippets copy-paste workflow per existing LOCKED rules.
- ✅ SSE transport: `/api/agents/:slug/chat` → Supabase 3 only.
- ✅ Dogfooding: Jimmy = self-building AI, apna CRM commit karega.
