---
name: Supabase 1 NEXATECT rebrand + hard heal LOCKED
description: Supabase 1 (purana HostFlow AI project) ki SQL sql/supabase1-nexatect/ mein — rebrand + RLS + linter heal. sql/founder/ (Supabase 3) se kabhi mix nahi, run-all-founder.sh isse nahi chalati.
type: constraint
---

# LOCKED (Aug 2026)

1. Supabase 1 SQL ka folder: `sql/supabase1-nexatect/`. Supabase 3 = `sql/founder/`. **Never mix.**
2. Master file: `20260810000000_supabase1_nexatect_rebrand_hard_heal.sql` — idempotent.
   Naya kaam aaye to **isi file ko extend** karo (NO DUPLICATE rule), nayi file sirf nayi phase ke liye.
3. Run: `psql "$SUPABASE1_DB_URL" -f sql/supabase1-nexatect/<file>.sql` — `run-all-founder.sh` mein **add nahi** karna.
4. Rebrand rule: `HostFlow AI` → `NEXATECT`, `HostFlow AI Technologies` → `NEXATECT Global`,
   `AXOMAIL` → `ANEXOMAIL`. Legacy naam `legacy_name` columns + `nexatect_rebrand_log` mein preserve.
5. RLS policy standard: `service_role` full · `authenticated` full ya owner-scoped
   (`user_id/owner_id/created_by/founder_id/profile_id/account_id`) · `anon` sirf brand/product catalog.
6. AI truth view: `public.nexatect_identity` — har agent yahi padhe (parent + products + status).
7. Dashboard-only warnings (SQL se nahi hote): leaked password protection ON, OTP expiry <3600s, Postgres upgrade.
