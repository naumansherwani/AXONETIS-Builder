# AXONETIS SQL — repo hi source of truth

Ab se **saari SQL repo mein aati hai** (chat mein paste nahi). Founder ka data aur awam ka
data hamesha alag folder mein — trace karna easy, servers bhi alag.

```
sql/
  founder/                 → Supabase 3 (self-hosted, Hetzner) — sirf founder builder
    phase-01-foundation/
    phase-03-agents/
    phase-3.9-publish-power-marketplace/
    phase-3.10-intelligence/
    phase-11-outreach/
    phase-12-final-lock/
    legacy-phase-03-06/    → purani db/migrations files (history ke liye rakhi hain)
  awam/                    → public AXONETIS (alag server, next month) — abhi khaali
```

## Rules (LOCKED)

1. Har naya phase = `sql/founder/phase-<NN>-<slug>/` ka **naya folder**, us folder mein
   `YYYYMMDDHHMMSS_<phase>_<name>.sql`.
2. Founder SQL kabhi `sql/awam/` mein nahi, awam SQL kabhi `sql/founder/` mein nahi.
3. Har file **idempotent** (`create table if not exists`, `add column if not exists`,
   `drop policy if exists` → `create policy`), taake dobara chalane pe safe rahe.
4. Public schema ki har nayi table ke saath usi file mein `GRANT` + RLS + policies.
5. Ek hi migration ko edit karke re-run karna theek hai (idempotent), duplicate file
   banana mana hai.

## Run karne ka tareeqa (Hetzner)

```bash
cd /var/www/axonetis && git pull
psql "$SUPABASE3_DB_URL" -f sql/founder/phase-12-final-lock/20260814000000_phase_12_settings_help.sql
```

Ya Supabase Studio → SQL Editor mein file ka content paste karke run.

> Note: `20260612000001_phase1_foundation.sql` mein founder email set karna zaroori hai —
> details `sql/founder/README-legacy-notes.md` mein.
