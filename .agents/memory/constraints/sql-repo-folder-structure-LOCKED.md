---
name: SQL repo folder structure LOCKED
description: Saari SQL repo mein jaati hai (chat paste nahi) — sql/founder/phase-<NN>-<slug>/ per phase, sql/awam/ public ke liye alag. Founder aur awam data kabhi mix nahi.
type: constraint
---

# LOCKED (Aug 2026)

1. SQL **repo mein** likhni hai — `sql/` folder. Chat mein poori SQL paste karna band
   (credits bachate hain). Chat mein sirf file path + run command dena hai.
2. Structure:
   - `sql/founder/phase-<NN>-<slug>/<timestamp>_<phase>_<name>.sql` — Supabase 3 (Hetzner, founder only)
   - `sql/awam/...` — public AXONETIS, **alag server** (founder ne next month banana hai)
3. Founder aur awam SQL kabhi ek folder/file mein mix nahi. Data trace karna easy rehna chahiye.
4. Har phase ka apna folder — nayi phase = naya folder, no duplicate files.
5. Har file idempotent + `GRANT` + RLS + policies same file mein.
6. Purani `hetzner-migrations/` aur `db/migrations/` folders **delete ho gaye** —
   content `sql/founder/` mein move hua (`legacy-phase-03-06/` purani wali).
7. Run: `cd /var/www/axonetis && git pull && psql "$SUPABASE3_DB_URL" -f sql/founder/<phase>/<file>.sql`

**Why:** Founder ne explicitly lock kiya — repo hi truth, credits bachte hain, founder/awam
data separation traceable rehta hai.
