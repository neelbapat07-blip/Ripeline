-- =====================================================================
--  Ripeline: expiry reminder emails (server side)
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It's safe to run again (for example after changing the sender email).
--
--  BEFORE running it, store your Brevo API key in Supabase's Vault (once):
--    select vault.create_secret('PASTE-YOUR-BREVO-API-KEY-HERE', 'brevo_api_key');
-- =====================================================================

-- 1. Tools Supabase needs: pg_net (sends web requests) and pg_cron (daily timer)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- 2. The table: one row per person who turned reminders on.
--    Holds only food names and expiration dates, plus their reminder choice.
create table if not exists public.expiry_reminders (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  enabled     boolean not null default true,
  days_before integer not null default 2 check (days_before between 0 and 14),
  items       jsonb not null default '[]'::jsonb,   -- [{ "name": "Milk", "expires": "2026-12-01" }, ...]
  notified    text[] not null default '{}',         -- foods already emailed about ("name|date")
  updated_at  timestamptz not null default now()
);

-- 3. Privacy: people can only see and change THEIR OWN row
alter table public.expiry_reminders enable row level security;

drop policy if exists "Read own reminders"   on public.expiry_reminders;
drop policy if exists "Add own reminders"    on public.expiry_reminders;
drop policy if exists "Change own reminders" on public.expiry_reminders;
drop policy if exists "Remove own reminders" on public.expiry_reminders;

create policy "Read own reminders" on public.expiry_reminders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own reminders" on public.expiry_reminders
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own reminders" on public.expiry_reminders
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Remove own reminders" on public.expiry_reminders
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.expiry_reminders from anon;
grant select, insert, update, delete on public.expiry_reminders to authenticated;

-- 4. The daily check: finds food that's about to expire and emails each person once
create or replace function public.send_expiry_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- The email address reminders come FROM. It must be a verified sender in Brevo.
  sender_email constant text := 'neelbapat07@gmail.com';
  app_link     constant text := 'https://ripeline-app.vercel.app/#home';
  api_key  text;
  person   record;
  due      jsonb;
  due_keys text[];
  list_html text;
  emails_sent integer := 0;
begin
  select decrypted_secret into api_key
  from vault.decrypted_secrets where name = 'brevo_api_key' limit 1;
  if api_key is null then
    raise exception 'Store the Brevo API key in the Vault first (name: brevo_api_key)';
  end if;

  for person in
    select r.user_id, r.name, r.days_before, r.items, r.notified, u.email
    from public.expiry_reminders r
    join auth.users u on u.id = r.user_id
    where r.enabled and u.email is not null and u.email_confirmed_at is not null
  loop
    -- Food expiring between today and "days_before" days from now, not emailed about yet
    select coalesce(jsonb_agg(i order by i->>'expires', i->>'name'), '[]'::jsonb)
      into due
    from jsonb_array_elements(person.items) as i
    where (i->>'expires') ~ '^\d{4}-\d{2}-\d{2}$'
      and (i->>'expires')::date between current_date and current_date + person.days_before
      and not (((i->>'name') || '|' || (i->>'expires')) = any (person.notified));

    continue when jsonb_array_length(due) = 0;

    select string_agg(format('<li><b>%s</b> – %s</li>',
             replace(replace(replace(i->>'name', '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
             case (i->>'expires')::date - current_date
               when 0 then 'expires today'
               when 1 then 'expires tomorrow'
               else 'expires in ' || ((i->>'expires')::date - current_date) || ' days (' || to_char((i->>'expires')::date, 'Mon DD') || ')'
             end), '')
      into list_html
    from jsonb_array_elements(due) as i;

    perform net.http_post(
      url     := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object('api-key', api_key, 'Content-Type', 'application/json', 'accept', 'application/json'),
      body    := jsonb_build_object(
        'sender',  jsonb_build_object('name', 'Ripeline', 'email', sender_email),
        'to',      jsonb_build_array(jsonb_build_object('email', person.email)),
        'subject', case when jsonb_array_length(due) = 1
                        then 'Ripeline: ' || (due->0->>'name') || ' is about to expire'
                        else 'Ripeline: ' || jsonb_array_length(due) || ' foods are about to expire' end,
        'htmlContent',
          '<h2>Use it before you lose it 🥦</h2>'
          || '<p>Hi' || case when coalesce(person.name, '') <> ''
                          then ' ' || replace(replace(replace(person.name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
                          else '' end || '! This food in your fridge is about to expire:</p>'
          || '<ul>' || list_html || '</ul>'
          || '<p><a href="' || app_link || '">Open Ripeline for recipe ideas</a></p>'
          || '<p style="color:#666;font-size:12px">You get these emails because you turned on expiry reminders. '
          || 'To stop them, open Ripeline → Profile → Notifications. Questions or feedback? Email '
          || sender_email || '.</p>'
      )
    );

    -- Remember what was emailed (and forget foods that are no longer in the list)
    select array_agg((i->>'name') || '|' || (i->>'expires')) into due_keys from jsonb_array_elements(due) as i;
    update public.expiry_reminders
       set notified = array(
             select distinct k from unnest(person.notified || due_keys) as k
             where k in (select (j->>'name') || '|' || (j->>'expires') from jsonb_array_elements(person.items) as j))
     where user_id = person.user_id;

    emails_sent := emails_sent + 1;
  end loop;

  return emails_sent;
end;
$$;

-- Only Supabase itself may run the daily check (not app visitors)
revoke execute on function public.send_expiry_reminders() from public, anon, authenticated;

-- 5. Run the check every day at 13:00 UTC (8 AM US Eastern, 5 AM US Pacific)
select cron.unschedule(jobid) from cron.job where jobname = 'ripeline-expiry-reminders';
select cron.schedule('ripeline-expiry-reminders', '0 13 * * *', $cron$select public.send_expiry_reminders();$cron$);
