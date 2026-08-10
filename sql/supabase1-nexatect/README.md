# SUPABASE 1 — NEXATECT™ REBRAND + HARD HEAL

> Yeh folder **sirf Supabase 1** (purana HostFlow AI project) ke liye hai.
> `sql/founder/` = Supabase 3. Dono kabhi mix nahi. `sql/run-all-founder.sh` isse **nahi** chalati.

## File

```
sql/supabase1-nexatect/20260810000000_supabase1_nexatect_rebrand_hard_heal.sql
```

## Kya karti hai

| # | Kaam | Kya theek hota hai |
|---|---|---|
| 1 | `nexatect_brand` + `nexatect_products` + `nexatect_identity` view | Har AI agent ko NEXATECT truth (legacy naam bhi preserve) |
| 2 | `HostFlow AI` → `NEXATECT`, `AXOMAIL` → `ANEXOMAIL` sab text columns mein | Data-level rebrand, `nexatect_rebrand_log` mein audit |
| 3 | Public schema ki **har table** par RLS + policies + GRANT | ~160 errors (rls_disabled / policy_missing) |
| 4 | Har function par `search_path` pin | ~function_search_path_mutable warnings |
| 5 | SECURITY DEFINER views → `security_invoker = true` | definer-view errors |
| 6 | Materialized views Data API se hide | mv_in_api warnings |
| 7 | Extensions `public` → `extensions` schema | extension_in_public warnings |
| 8 | VERIFY report (aakhir mein) | 0 rows = 100% green |

Policy rule: `service_role` = full · `authenticated` = full (ya owner-scoped agar
`user_id/owner_id/created_by/founder_id` column mila) · `anon` = kuch nahi
(sirf brand/product catalog readable).

100% **idempotent** — jitni baar chalao, kuch nahi tootta.

## Run (Supabase 1 DB URL ke saath)

```bash
cd /var/www/axonetis && git pull && \
psql "$SUPABASE1_DB_URL" -v ON_ERROR_STOP=1 \
  -f sql/supabase1-nexatect/20260810000000_supabase1_nexatect_rebrand_hard_heal.sql
```

Ya Supabase 1 Studio → SQL Editor mein poori file paste karke Run.

## SQL se fix NAHI hota (Dashboard se karna hai)

- Auth → **Leaked password protection: ON**
- Auth → **OTP expiry: 3600s se kam**
- Settings → Infrastructure → **Postgres upgrade**

## NEXATECT™ Global — products (registry mein seed hai)

```
NEXATECT™ Global   (ex "HostFlow AI Technologies")  — parent company
├── AANRIS™            Self-Healing Runtime            live
├── AXONETIS™          AI Builder                      live      axonetis.com
├── ANEXOMAIL™         Sovereign Communication         building  anexomail.com
├── ANEXVOT™ AI Pay    Treasury Core                   FUTURE    anexvotpay.com
└── Industry agents: Aria · Orion · Rex · Lyra · Sage · Atlas · Vega · Kai
```
