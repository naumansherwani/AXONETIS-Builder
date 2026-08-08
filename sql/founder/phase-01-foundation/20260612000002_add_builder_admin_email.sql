-- =====================================================================
-- AXONETIS — Phase 1 patch: add hostflowaibuilder@gmail.com as founder/admin
-- Target: Hetzner Supabase 3 (aiaxonetis.nexatect.com)
-- Safe to re-run (idempotent).
-- =====================================================================

-- 1) Replace trigger function so future signups of this email auto-admin too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  founder_emails constant text[] := array[
    'naumansherwani@nexatect.com',
    'naumankhansherwani@gmail.com',
    'hostflowaibuilder@gmail.com'
  ];
begin
  if new.email = any(founder_emails) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
      on conflict (user_id, role) do nothing;
    insert into public.user_roles (user_id, role) values (new.id, 'founder')
      on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

-- 2) Backfill: if hostflowaibuilder@gmail.com already exists in auth.users, grant now.
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where u.email = 'hostflowaibuilder@gmail.com'
on conflict (user_id, role) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'founder'::public.app_role
from auth.users u
where u.email = 'hostflowaibuilder@gmail.com'
on conflict (user_id, role) do nothing;

-- 3) Verify
-- select u.email, r.role
-- from public.user_roles r
-- join auth.users u on u.id = r.user_id
-- order by u.email, r.role;
