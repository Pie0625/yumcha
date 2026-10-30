-- Yumcha community: tables and security rules.
--
-- Run this once in Supabase: open your project, go to SQL Editor, paste this whole
-- file and press Run. It is safe to run again (it skips things that already exist).
--
-- What it sets up:
--   experiences  one post per person per cafe: a 1 to 5 rating and a short text
--   reports      "report this post" messages. Only you can read them (Table Editor)
--
-- Security: row level security is switched on, so the public key in js/config.js can only
-- do what the policies below allow. Without these policies anyone could change anything.

-- ---------------------------------------------------------------- experiences
create table if not exists public.experiences (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     text not null
              check (cafe_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(cafe_id) <= 80),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default 'Member',
  rating      smallint not null check (rating between 1 and 5),
  body        text not null check (char_length(btrim(body)) between 10 and 1000),
  created_at  timestamptz not null default now(),
  unique (cafe_id, user_id)
);

create index if not exists experiences_cafe_idx on public.experiences (cafe_id, created_at desc);

alter table public.experiences enable row level security;

drop policy if exists "Anyone can read experiences" on public.experiences;
create policy "Anyone can read experiences"
  on public.experiences for select
  using (true);

drop policy if exists "Signed-in people can post as themselves" on public.experiences;
create policy "Signed-in people can post as themselves"
  on public.experiences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "People can delete their own experiences" on public.experiences;
create policy "People can delete their own experiences"
  on public.experiences for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- There is no update policy on purpose: to change a post, delete it and post again.

grant select on public.experiences to anon, authenticated;
grant insert, delete on public.experiences to authenticated;

-- The name shown on a post always comes from the poster's account (display_name), never from
-- the request, so nobody can post under someone else's name.
create or replace function public.experiences_set_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
    into v_name
    from auth.users u
   where u.id = new.user_id;

  new.author_name := left(coalesce(v_name, 'Member'), 40);
  return new;
end;
$$;

drop trigger if exists experiences_set_author on public.experiences;
create trigger experiences_set_author
  before insert on public.experiences
  for each row execute function public.experiences_set_author();

-- -------------------------------------------------------------------- reports
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason        text not null check (char_length(btrim(reason)) between 3 and 300),
  created_at    timestamptz not null default now(),
  unique (experience_id, user_id)
);

alter table public.reports enable row level security;

drop policy if exists "Signed-in people can report" on public.reports;
create policy "Signed-in people can report"
  on public.reports for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- No select policy: nobody using the website can read reports. You read them in the
-- Supabase dashboard (Table Editor > reports) and delete bad posts from there.

grant insert on public.reports to authenticated;
