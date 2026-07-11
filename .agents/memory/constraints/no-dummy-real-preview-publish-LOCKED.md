---
name: NO DUMMY — Real Preview + Publish on founderbuilder.axonetis.com
description: Founder lock — AXONETIS Builder ka preview aur publish REAL working chahiye, self-hosted founderbuilder.axonetis.com pe. Koi dummy/stub/mock nahi.
type: constraint
---

# LOCKED — No Dummy, Real Preview + Real Publish (Jul 2026)

Founder ne lock kiya: **sab kuch khud ka system**, koi dummy nahi.

## Hard Rules

1. **Preview REAL hona chahiye.** Builder ke andar jo preview iframe hai woh actual sandbox environment se render kare — `project_files` (Supabase 3) → HMR bridge → live iframe. Placeholder screenshots, static mock previews, ya "coming soon" cards BAN hain.

2. **Publish REAL hona chahiye.** Publish button dabate hi:
   - Sandbox `project_files` → production diff
   - Sherlock final audit
   - Atomic promote to production on **founderbuilder.axonetis.com** (Hetzner + Caddy + PM2)
   - `git pull` on server → build → `pm2 reload`
   - Zero manual SSH
   - Lovable ka apna `.lovable.app` publish button founder ke liye USELESS — self-host only

3. **Hosting = founderbuilder.axonetis.com** (Hetzner, self-hosted, own Supabase, own Caddy). Lovable hosting NEVER used for production. Lovable = source-of-truth editor only, code GitHub pe push hota hai, server pull karta hai.

4. **NO DUMMY DATA.** Har panel, har button, har endpoint real data ya real action se wire hona chahiye. Agar backend abhi ready nahi to UI mein clearly "not wired yet — Phase X" dikhao, fake numbers/mock rows/lorem ipsum NAHI.

5. **GitHub sync ON.** `founder-ai-builder` repo ↔ Lovable bidirectional. Every Lovable edit → auto-push → founder server pe `git pull` → live.

## Enforcement

- Koi bhi PR/edit jo dummy value hardcode kare → REJECT.
- Koi bhi panel jo "coming soon" chip ke saath ship ho → REJECT jab tak real endpoint na wire ho.
- Preview iframe agar `about:blank` ya static image dikhaye → REJECT.
- Publish button agar sirf `console.log` kare → REJECT.

## Cross-refs
- `lovable-clone-master-vision-LOCKED` — publish = full deploy parity
- `hetzner-caddyfile-live-LOCKED` — Caddy routing
- `hetzner-pm2-online-LOCKED` — PM2 process manager
- `builder-workflow-rules` — 2 repos, phase-by-phase pull
