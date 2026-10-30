-- Yumcha Community page: posts, reactions, reports and the photo storage.
--
-- Run this once in Supabase, AFTER schema.sql: open SQL Editor, paste this whole file and
-- press Run. It is safe to run again (it skips or replaces what already exists).
--
-- What it sets up:
--   posts           a "recommend a place" post (place, three ratings, photos, text) or a discussion post
--   post_reactions  likes and other reactions on posts
--   post_reports    "report this post" messages. Only you can read them (Table Editor)
--   post-photos     a storage bucket for the photos people attach to posts
--
-- Security: row level security is on for every table, so the public key in js/config.js can
-- only do what the policies below allow.

-- ---------------------------------------------------------------- helper
-- Photo paths look like <user id>/<random id>.jpg. This checks the shape and that there are
-- at most 3, so nobody can store other addresses in a post.
create or replace function public.valid_photo_paths(p text[])
returns boolean
language sql
immutable
as $$
  select coalesce(cardinality(p), 0) <= 3
     and not exists (
       select 1 from unnest(p) as x
        where x !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
     );
$$;

-- ---------------------------------------------------------------- posts
create table if not exists public.posts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name        text not null default 'Member',
  kind               text not null check (kind in ('recommendation', 'discussion')),
  -- The place being recommended. cafe_id is set when it is one of the cafes on the site.
  cafe_id            text check (cafe_id is null
                             or (cafe_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(cafe_id) <= 80)),
  place_name         text check (place_name is null or char_length(btrim(place_name)) between 2 and 80),
  place_area         text check (place_area is null or char_length(btrim(place_area)) <= 80),
  maps_url           text check (maps_url is null
                             or (char_length(maps_url) <= 300
                                 and maps_url ~* '^https://((www|maps)\.google\.(com|[a-z]{2,3}|com?\.[a-z]{2})/(maps|\?)|maps\.app\.goo\.gl/|goo\.gl/maps/)')),
  rating_environment smallint check (rating_environment between 1 and 5),
  rating_food        smallint check (rating_food between 1 and 5),
  rating_price       smallint check (rating_price between 1 and 5),
  body               text not null check (char_length(btrim(body)) between 10 and 1000),
  photos             text[] not null default '{}' check (public.valid_photo_paths(photos)),
  created_at         timestamptz not null default now(),
  -- A recommendation needs a place and all three ratings. A discussion has none of them.
  constraint posts_kind_fields check (
    (kind = 'recommendation'
       and place_name is not null
       and rating_environment is not null and rating_food is not null and rating_price is not null)
    or
    (kind = 'discussion'
       and cafe_id is null and place_name is null and place_area is null and maps_url is null
       and rating_environment is null and rating_food is null and rating_price is null)
  )
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_kind_created_idx on public.posts (kind, created_at desc);

alter table public.posts enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts"
  on public.posts for select
  using (true);

drop policy if exists "Signed-in people can post as themselves" on public.posts;
create policy "Signed-in people can post as themselves"
  on public.posts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "People can delete their own posts" on public.posts;
create policy "People can delete their own posts"
  on public.posts for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- No update policy on purpose: to change a post, delete it and post again.

grant select on public.posts to anon, authenticated;
grant insert, delete on public.posts to authenticated;

-- The name on a post comes from the poster's account, never from the request, and photos
-- must sit in the poster's own folder.
create or replace function public.posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_path text;
begin
  select nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
    into v_name
    from auth.users u
   where u.id = new.user_id;

  new.author_name := left(coalesce(v_name, 'Member'), 40);

  foreach v_path in array new.photos loop
    if split_part(v_path, '/', 1) <> new.user_id::text then
      raise exception 'Photos must be in your own folder';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert
  before insert on public.posts
  for each row execute function public.posts_before_insert();

-- ---------------------------------------------------------------- reactions
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('like', 'yum', 'helpful')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

alter table public.post_reactions enable row level security;

drop policy if exists "Anyone can read reactions" on public.post_reactions;
create policy "Anyone can read reactions"
  on public.post_reactions for select
  using (true);

drop policy if exists "Signed-in people can react as themselves" on public.post_reactions;
create policy "Signed-in people can react as themselves"
  on public.post_reactions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "People can remove their own reactions" on public.post_reactions;
create policy "People can remove their own reactions"
  on public.post_reactions for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.post_reactions to anon, authenticated;
grant insert, delete on public.post_reactions to authenticated;

-- Totals per post and reaction, so the website does not have to count rows itself.
create or replace view public.post_reaction_counts
  with (security_invoker = true)
as
  select post_id, kind, count(*)::int as total
    from public.post_reactions
   group by post_id, kind;

grant select on public.post_reaction_counts to anon, authenticated;

-- ---------------------------------------------------------------- reports
create table if not exists public.post_reports (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason     text not null check (char_length(btrim(reason)) between 3 and 300),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_reports enable row level security;

drop policy if exists "Signed-in people can report posts" on public.post_reports;
create policy "Signed-in people can report posts"
  on public.post_reports for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- No select policy: nobody using the website can read reports. You read them in the
-- Supabase dashboard (Table Editor > post_reports) and delete bad posts from there.

grant insert on public.post_reports to authenticated;

-- ---------------------------------------------------------------- photo storage
-- Public bucket: anyone can see a photo if they have its link, which is what the feed uses.
-- The website shrinks every photo to a JPEG before uploading, so the limits are small.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg'];

-- People can only add, see and delete files inside the folder named after their own user id.
drop policy if exists "People can upload photos to their own folder" on storage.objects;
create policy "People can upload photos to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "People can see their own photo files" on storage.objects;
create policy "People can see their own photo files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "People can delete their own photos" on storage.objects;
create policy "People can delete their own photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
