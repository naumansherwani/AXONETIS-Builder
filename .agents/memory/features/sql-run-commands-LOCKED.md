---
name: SQL run commands LOCKED (Supabase 3)
description: Founder ke fixed do commands har SQL phase ke liye — README padhna phir run-all-founder.sh Supabase 3 DB URL ke saath. Koi teesra tareeqa nahi.
type: preference
---

# LOCKED — har SQL run isi tarah hoga

**Command 1 (order padho):**

```bash
cat /var/www/axonetis/sql/README-RUN-ORDER.md
```

**Command 2 (run karo — Supabase 3, hamesha AXONETIS_DB_URL ke saath):**

```bash
cd /var/www/axonetis && \
AXONETIS_DB_URL='postgresql://postgres:SUPABASE3_DB_PASSWORD@db.itoejjzjjprjnrhygjal.supabase.co:5432/postgres' \
bash sql/run-all-founder.sh
```

## Rules
- SQL target = **Supabase 3** (`db.itoejjzjjprjnrhygjal.supabase.co:5432`), **local 127.0.0.1 nahi** —
  bina `AXONETIS_DB_URL` script local pe girti hai aur password maangti hai.
- Password chat mein na likhna — placeholder `SUPABASE3_DB_PASSWORD` rakhna, founder khud bharega.
- Naya phase = naya file `sql/founder/phase-*/` mein + `sql/run-all-founder.sh` ke `FILES=()` array mein
  usi order pe add. Duplicate file kabhi nahi.
- `.sql` → psql. `.ts` / `.js` / `.sh` → repo file, psql mein **never**.
- `sql/founder/legacy-phase-03-06/` kabhi nahi chalani.
- Har code push ke baad Hetzner pull block dena hai (Core rule).

## VERIFIED (Aug 2026)
`bash sql/run-all-founder.sh` ne 17/17 file `OK` diye → **ALL SQL GREEN ✅**.
Script hi order sambhalti hai — founder ko koi individual SQL chat se copy-paste **nahi** karni.
Naya phase aaye to sirf file + `FILES=()` entry, phir wahi ek command dobara. Yeh default hai.
