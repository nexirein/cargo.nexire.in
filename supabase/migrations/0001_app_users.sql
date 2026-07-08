-- app_users: application-level identity + role, linked 1:1 to Supabase auth.users
create table app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text unique not null,
  full_name text,
  role text not null check (role in ('admin','lead','operator','reviewer','viewer')),
  team_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- security definer helper so RLS policies can check the caller's role/id
-- without recursively evaluating RLS on app_users itself.
create or replace function app_current_user_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from app_users where auth_user_id = auth.uid();
$$;

create or replace function app_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from app_users where auth_user_id = auth.uid();
$$;

create or replace function app_is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_active from app_users where auth_user_id = auth.uid()), false);
$$;

alter table app_users enable row level security;
