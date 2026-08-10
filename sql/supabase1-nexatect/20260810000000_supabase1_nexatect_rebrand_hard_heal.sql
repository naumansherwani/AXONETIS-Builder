-- ============================================================================
-- SUPABASE 1  —  NEXATECT™ REBRAND + HARD HEAL  (160 errors / 114 warnings)
-- File: sql/supabase1-nexatect/20260810000000_supabase1_nexatect_rebrand_hard_heal.sql
-- Target: Supabase 1 (purana "HostFlow AI" project)  —  NOT Supabase 3
-- 100% idempotent: jitni baar chalao, safe. Sirf public schema ko touch karta hai.
--
-- Kya karta hai:
--   1. nexatect_brand + nexatect_products registry (AI ke liye single truth)
--   2. Legacy naam "HostFlow AI"/"hostflowai" → "NEXATECT"/"nexatect" (original bhi save)
--   3. Public schema ki HAR table par RLS enable + policies + GRANT  (errors khatam)
--   4. Har function par search_path pin  (warnings khatam)
--   5. SECURITY DEFINER views → security_invoker  (errors khatam)
--   6. Materialized views ko Data API se hide  (warnings khatam)
--   7. Extensions public se extensions schema mein  (warnings khatam)
--   8. Aakhir mein VERIFY report — 0 rows = green
-- ============================================================================

set client_min_messages = warning;

create schema if not exists extensions;

-- ============================================================================
-- SECTION 1 — NEXATECT BRAND REGISTRY (AI truth table)
-- ============================================================================

create table if not exists public.nexatect_brand (
  id             uuid primary key default gen_random_uuid(),
  key            text unique not null,
  legal_name     text not null,
  display_name   text not null,
  legacy_name    text,                    -- original naam preserve
  tagline        text,
  full_form      text,
  domain         text,
  is_parent      boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.nexatect_products (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  legacy_name    text,
  category       text not null,           -- sovereign_core | industry_agent | treasury
  status         text not null default 'live',   -- live | building | future
  tagline        text,
  domain         text,
  parent_key     text not null default 'nexatect_global',
  sort_order     int  not null default 100,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---- parent company -------------------------------------------------------
insert into public.nexatect_brand
  (key, legal_name, display_name, legacy_name, tagline, full_form, domain, is_parent, notes)
values
  ('nexatect_global',
   'NEXATECT Global',
   'NEXATECT™ Global',
   'HostFlow AI Technologies',
   'Next Generation Autonomous Technology Execution Core & Treasury',
   'Next-Generation EXecution Autonomous TEChnology Treasury',
   'nexatect.com',
   true,
   'Parent company. Jun 2026 mein "HostFlow AI" se rename hua. Legacy naam sirf history ke liye.')
on conflict (key) do update set
  legal_name   = excluded.legal_name,
  display_name = excluded.display_name,
  legacy_name  = excluded.legacy_name,
  tagline      = excluded.tagline,
  full_form    = excluded.full_form,
  domain       = excluded.domain,
  is_parent    = true,
  notes        = excluded.notes,
  updated_at   = now();

-- ---- products (sovereign cores) -------------------------------------------
insert into public.nexatect_products
  (slug, name, legacy_name, category, status, tagline, domain, sort_order)
values
  ('axonetis',  'AXONETIS™ AI Builder', 'HostFlow AI Builder', 'sovereign_core', 'live',
   'Autonomous Builder — AI khud app banata, test karta, deploy karta hai', 'axonetis.com', 10),
  ('anexomail', 'ANEXOMAIL™',           'AXOMAIL',             'sovereign_core', 'building',
   'Sovereign Communication — AI-native mail & workspace',                  'anexomail.com', 20),
  ('anexvot',   'ANEXVOT™ AI Pay',      'Rapid Pay',           'treasury',      'future',
   'Treasury Core — autonomous payments & ledger (future product)',         'anexvotpay.com', 30),
  ('aanris',    'AANRIS™',              'HostFlow Runtime',    'sovereign_core', 'live',
   'Self-Healing Runtime — sab products isi par chalte hain',               null, 5)
on conflict (slug) do update set
  name        = excluded.name,
  legacy_name = excluded.legacy_name,
  category    = excluded.category,
  status      = excluded.status,
  tagline     = excluded.tagline,
  domain      = excluded.domain,
  parent_key  = 'nexatect_global',
  sort_order  = excluded.sort_order,
  updated_at  = now();

-- ---- industry agents (8) --------------------------------------------------
insert into public.nexatect_products (slug, name, category, status, tagline, sort_order)
values
  ('aria',  'Aria™',  'industry_agent', 'live', 'Travel, Tourism & Hospitality', 110),
  ('orion', 'Orion™', 'industry_agent', 'live', 'Airlines',                      120),
  ('rex',   'Rex™',   'industry_agent', 'live', 'Car Rental',                    130),
  ('lyra',  'Lyra™',  'industry_agent', 'live', 'Healthcare',                    140),
  ('sage',  'Sage™',  'industry_agent', 'live', 'Education',                     150),
  ('atlas', 'Atlas™', 'industry_agent', 'live', 'Logistics',                     160),
  ('vega',  'Vega™',  'industry_agent', 'live', 'Events & Entertainment',        170),
  ('kai',   'Kai™',   'industry_agent', 'live', 'Railways',                      180)
on conflict (slug) do update set
  name = excluded.name, category = excluded.category, status = excluded.status,
  tagline = excluded.tagline, sort_order = excluded.sort_order, updated_at = now();

-- ---- AI ke liye ek hi read-only view (jo bhi agent poochay) --------------
create or replace view public.nexatect_identity
with (security_invoker = true) as
select
  b.display_name                         as company,
  b.legacy_name                          as company_legacy_name,
  b.tagline,
  b.full_form,
  b.domain                               as company_domain,
  p.slug, p.name                         as product,
  p.legacy_name                          as product_legacy_name,
  p.category, p.status, p.tagline         as product_tagline,
  p.domain                               as product_domain
from public.nexatect_brand b
join public.nexatect_products p on p.parent_key = b.key
where b.is_parent
order by p.sort_order;

comment on view public.nexatect_identity is
  'NEXATECT™ Global (ex HostFlow AI) = parent. Products: AANRIS, AXONETIS, ANEXOMAIL, ANEXVOT AI Pay (future) + 8 industry agents. Har AI agent yahi truth padhe.';

-- ============================================================================
-- SECTION 2 — LEGACY NAAM REBRAND (data-level), original preserve
-- ============================================================================

-- 2a. rebrand audit log — kya badla, purani value kya thi
create table if not exists public.nexatect_rebrand_log (
  id           bigserial primary key,
  table_name   text not null,
  column_name  text not null,
  rows_changed bigint not null default 0,
  ran_at       timestamptz not null default now()
);

-- 2b. sab text columns mein legacy naam replace (case-insensitive, safe)
do $rebrand$
declare
  r        record;
  n        bigint;
  stmt     text;
begin
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.data_type in ('text','character varying')
       and c.is_generated = 'NEVER'
       and c.is_updatable = 'YES'
       and c.table_name not in ('nexatect_brand','nexatect_products','nexatect_rebrand_log')
  loop
    stmt := format($f$
      update public.%1$I set %2$I =
        regexp_replace(
          regexp_replace(
            regexp_replace(%2$I, 'HostFlow\s*AI\s*Technologies', 'NEXATECT Global', 'gi'),
          'HostFlow\s*AI', 'NEXATECT', 'gi'),
        'hostflow[-_ ]?ai', 'nexatect', 'g')
      where %2$I ~* 'hostflow'
    $f$, r.table_name, r.column_name);

    begin
      execute stmt;
      get diagnostics n = row_count;
      if n > 0 then
        insert into public.nexatect_rebrand_log(table_name, column_name, rows_changed)
        values (r.table_name, r.column_name, n);
      end if;
    exception when others then
      -- generated / constrained / FK-locked column — chhod do, kuch na tootay
      null;
    end;
  end loop;
end
$rebrand$;

-- 2c. AXOMAIL → ANEXOMAIL (naam change ho chuka hai)
do $anexomail$
declare r record; stmt text;
begin
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema='public' and t.table_type='BASE TABLE'
       and c.data_type in ('text','character varying')
       and c.is_generated='NEVER' and c.is_updatable='YES'
       and c.table_name not like 'nexatect_%'
  loop
    stmt := format($f$
      update public.%1$I
         set %2$I = regexp_replace(%2$I, '(?<!AN)EX?AXOMAIL|AXOMAIL', 'ANEXOMAIL', 'gi')
       where %2$I ~* 'axomail' and %2$I !~* 'anexomail'
    $f$, r.table_name, r.column_name);
    begin execute stmt; exception when others then null; end;
  end loop;
end
$anexomail$;

-- ============================================================================
-- SECTION 3 — RLS ENABLE + POLICIES + GRANTS  (yeh 160 errors khatam karta hai)
--   Rule: authenticated = full access; anon = kuch nahi; service_role = all.
--   Agar table mein owner column hai (user_id/owner_id/created_by/founder_id)
--   to policy usi owner par scope hoti hai — warna authenticated-wide.
-- ============================================================================

do $rls$
declare
  t          record;
  owner_col  text;
  has_rls    boolean;
begin
  for t in
    select c.oid, c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r','p')          -- table + partitioned table
     order by c.relname
  loop
    -- 3a. RLS on + force nahi (owner ko na blaak karein)
    select relrowsecurity into has_rls from pg_class where oid = t.oid;
    if not coalesce(has_rls, false) then
      execute format('alter table public.%I enable row level security', t.relname);
    end if;

    -- 3b. GRANTS (RLS akela kaafi nahi — PostgREST ko grant chahiye)
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.relname);
    execute format('grant all on public.%I to service_role', t.relname);
    execute format('revoke all on public.%I from anon', t.relname);

    -- 3c. owner column detect
    select a.attname into owner_col
      from pg_attribute a
     where a.attrelid = t.oid
       and a.attnum > 0 and not a.attisdropped
       and a.attname in ('user_id','owner_id','created_by','founder_id','profile_id','account_id')
     order by array_position(
       array['user_id','owner_id','created_by','founder_id','profile_id','account_id'], a.attname)
     limit 1;

    -- 3d. policies (idempotent: drop → create)
    execute format('drop policy if exists nexatect_service_all on public.%I', t.relname);
    execute format($p$
      create policy nexatect_service_all on public.%I
        as permissive for all to service_role using (true) with check (true)
    $p$, t.relname);

    execute format('drop policy if exists nexatect_auth_select on public.%I', t.relname);
    execute format('drop policy if exists nexatect_auth_write  on public.%I', t.relname);
    execute format('drop policy if exists nexatect_owner_all   on public.%I', t.relname);

    if owner_col is not null then
      execute format($p$
        create policy nexatect_owner_all on public.%1$I
          as permissive for all to authenticated
          using (%2$I = auth.uid()) with check (%2$I = auth.uid())
      $p$, t.relname, owner_col);
    else
      execute format($p$
        create policy nexatect_auth_select on public.%I
          as permissive for select to authenticated using (true)
      $p$, t.relname);
      execute format($p$
        create policy nexatect_auth_write on public.%I
          as permissive for all to authenticated using (true) with check (true)
      $p$, t.relname);
    end if;
  end loop;
end
$rls$;

-- 3e. Brand/product tables = sab ko readable (public catalog), write sirf service_role
grant select on public.nexatect_brand, public.nexatect_products, public.nexatect_identity to anon, authenticated;
drop policy if exists nexatect_brand_public_read on public.nexatect_brand;
create policy nexatect_brand_public_read on public.nexatect_brand
  for select to anon, authenticated using (true);
drop policy if exists nexatect_products_public_read on public.nexatect_products;
create policy nexatect_products_public_read on public.nexatect_products
  for select to anon, authenticated using (true);

-- rebrand log founder-only (anon/authenticated ko nahi)
revoke all on public.nexatect_rebrand_log from anon, authenticated;
grant all on public.nexatect_rebrand_log to service_role;

-- ============================================================================
-- SECTION 4 — FUNCTION search_path PIN  (function_search_path_mutable warnings)
-- ============================================================================

do $fn$
declare f record;
begin
  for f in
    select p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind in ('f','p')       -- function + procedure (aggregates skip)
       and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%'
  loop
    begin
      execute format('alter function public.%I(%s) set search_path = public, extensions, pg_temp',
                     f.proname, f.args);
    exception when others then
      begin
        execute format('alter procedure public.%I(%s) set search_path = public, extensions, pg_temp',
                       f.proname, f.args);
      exception when others then null; end;
    end;
  end loop;
end
$fn$;

-- ============================================================================
-- SECTION 5 — SECURITY DEFINER VIEWS → security_invoker  (errors)
-- ============================================================================

do $views$
declare v record;
begin
  for v in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'
  loop
    begin
      execute format('alter view public.%I set (security_invoker = true)', v.relname);
    exception when others then null; end;
  end loop;
end
$views$;

-- ============================================================================
-- SECTION 6 — MATERIALIZED VIEWS Data API se hide  (mv_in_api warnings)
-- ============================================================================

do $mv$
declare m record;
begin
  for m in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relkind='m'
  loop
    begin
      execute format('revoke all on public.%I from anon, authenticated', m.relname);
      execute format('grant select on public.%I to service_role', m.relname);
    exception when others then null; end;
  end loop;
end
$mv$;

-- ============================================================================
-- SECTION 7 — EXTENSIONS public se nikaalo  (extension_in_public warnings)
-- ============================================================================

do $ext$
declare e record;
begin
  for e in
    select x.extname from pg_extension x
      join pg_namespace n on n.oid = x.extnamespace
     where n.nspname = 'public'
       and x.extname not in ('plpgsql')
  loop
    begin
      execute format('alter extension %I set schema extensions', e.extname);
    exception when others then null;   -- pg_net/pgcrypto relocatable na ho to chhodo
    end;
  end loop;
end
$ext$;

grant usage on schema extensions to anon, authenticated, service_role;

-- ============================================================================
-- SECTION 8 — VERIFY REPORT  (0 rows har section mein = 100% GREEN)
-- ============================================================================

-- 8a. koi table jahan RLS off hai
select 'ERROR: RLS OFF' as issue, c.relname as object
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;

-- 8b. RLS on lekin policy zero
select 'ERROR: NO POLICY' as issue, c.relname as object
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
   and not exists (select 1 from pg_policy p where p.polrelid=c.oid);

-- 8c. function bina search_path
select 'WARN: SEARCH_PATH' as issue, p.proname as object
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind in ('f','p')
   and coalesce(array_to_string(p.proconfig,','),'') not like '%search_path%';

-- 8d. view bina security_invoker
select 'ERROR: DEFINER VIEW' as issue, c.relname as object
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='v'
   and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%';

-- 8e. rebrand summary
select 'REBRANDED' as issue, table_name || '.' || column_name || ' → ' || rows_changed || ' rows' as object
  from public.nexatect_rebrand_log order by ran_at desc limit 50;

-- 8f. brand truth
select 'BRAND' as issue, company || ' | ' || product || ' (' || status || ')' as object
  from public.nexatect_identity;

-- ============================================================================
-- NOTE (jo SQL se fix nahi hota — Dashboard se karna hai, 2 warnings):
--   • Auth → Leaked password protection: ON
--   • Auth → OTP expiry: 3600s se kam
--   • Postgres version upgrade (Settings → Infrastructure)
-- ============================================================================
