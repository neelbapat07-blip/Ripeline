-- =====================================================================
--  Ripeline: account sync (same fridge on every device)
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It's safe to run again.
-- =====================================================================

-- 1. The table: one row per account with its food, shopping list, profile and preferences
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  shopping   jsonb not null default '[]'::jsonb,
  profile    jsonb not null default '{}'::jsonb,
  prefs      jsonb not null default '{}'::jsonb,
  device_id  text not null default '',
  updated_at timestamptz not null default now(),
  -- keep each account's data a sensible size (about 1 MB)
  constraint user_data_size check (octet_length(items::text) + octet_length(shopping::text) < 1000000)
);

-- 2. Privacy: each person can only see and change THEIR OWN data
alter table public.user_data enable row level security;

drop policy if exists "Read own data"   on public.user_data;
drop policy if exists "Add own data"    on public.user_data;
drop policy if exists "Change own data" on public.user_data;
drop policy if exists "Remove own data" on public.user_data;

create policy "Read own data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own data" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Remove own data" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- 3. Live updates: let open devices hear about changes right away
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_data') then
    alter publication supabase_realtime add table public.user_data;
  end if;
end $$;
