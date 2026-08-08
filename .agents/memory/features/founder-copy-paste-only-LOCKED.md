---
name: Founder Copy-Paste Only Workflow LOCKED
description: Founder ka role sirf copy-paste. Lovable = frontend + backend code author. Founder server/Supabase pe sirf paste karta hai.
type: constraint
---

# LOCKED — Founder Copy-Paste Only Rule (Jun 13, 2026)

Founder ne cheekh ke bola: **"tum hi frontend ho aur tum hi backend ho"**.

## Hard rules (zero exceptions)

1. **Lovable = frontend author + backend author.** Saara TypeScript / SQL / config Lovable likhega.
2. **Founder = sirf copy-paste karta hai.** Hetzner server pe ya Supabase SQL editor pe. Bas.
3. Jab frontend phase complete ho, Lovable **terminal/copy-paste ready** backend block deta hai:
   - Server TypeScript → ek file ya ek `cat > ... <<'EOF'` block
   - SQL migration → ek `psql` ya Supabase SQL editor block
   - PM2 restart / env var → ek single line command
4. Founder ko **kabhi** "yeh logic likho", "yeh function banao", "yeh decide karo" nahi bolna. Lovable hi likhega.
5. Founder ko architecture questions nahi puchne — Lovable existing locked memory padhe aur khud decide kare. Sirf scope confirm karna ho to ek line mein pucho.
6. Har backend deliverable ke saath yeh shout karna:
   - **"⚠️ YEH HOSTFLOW-SERVER (BRIDGE) REPO KI FILE HAI"** (Hetzner paste) ya
   - **"⚠️ YEH SUPABASE 3 SQL HAI"** (SQL editor paste)
7. Code blocks **chote, scoped, ek hi kaam ke** — founder ko 5 jaga paste nahi karna padhe. Ek block = ek paste.
8. Multi-step paste ho to **numbered steps** + har step ke saath uska ek hi command/block.
9. **Server/path kabhi assume nahi karna.** Founder ke paas multiple Hetzner machines hain. Har server command se pehle ek read-only discovery block se hostname + exact repo path + entrypoint + PM2 process verify hoga.
10. Discovery output aaye baghair deploy/wiring command dena forbidden hai. `/root/hostflow-server` aur `/var/www/axonetis` jaise guessed/stale paths kabhi use nahi karne.
11. Founder se koi manual edit nahi: wiring bhi Lovable-authored **single idempotent script/full-file overwrite block** se hogi. Founder sirf poora block paste/run karega.
12. Repo mein migration/snippet hone ka matlab founder ke server par file available hona nahi. SQL maange to **poora SQL chat mein paste** karna; server snippet maange to poora file heredoc mein dena.

## Why
Founder bar bar atak raha hai kyun ke pehle vague architecture mil raha tha. Ab Lovable owner hai dono taraf ka — frontend bhi, backend bhi. Founder sirf executor (paste).

## Cross-refs
- `server-endpoint-copy-paste-workflow-LOCKED` — endpoint contract details
- `hostflow-server-file-tree-LOCKED` — kaunsi file kis repo ki hai
- `phase3-final-layout-and-frontend-bridge-LOCKED` — Lovable repo = Builder frontend workspace
