-- OrbitX Mobile: social graph (profiles, posts, likes, reposts, follows)
-- Public read; owners write. No key material anywhere near here.

-- ── profiles (1:1 with auth.users) ──
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-zA-Z0-9_]{1,30}$'),
  display_name text not null default '',
  avatar_url text,
  bio text default '',
  created_at timestamptz not null default now()
);

-- ── posts ──
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  cashtags text[] not null default '{}', -- e.g. {BONK,SOL} extracted client-side
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_user_idx on public.posts (user_id);

-- ── likes ──
create table if not exists public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ── reposts ──
create table if not exists public.reposts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ── follows ──
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ── RLS: public read, owner write ──
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.reposts enable row level security;
alter table public.follows enable row level security;

-- profiles
drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
drop policy if exists "profiles owner insert" on public.profiles;
create policy "profiles owner insert" on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update" on public.profiles for update using (auth.uid() = user_id);

-- posts
drop policy if exists "posts public read" on public.posts;
create policy "posts public read" on public.posts for select using (true);
drop policy if exists "posts owner insert" on public.posts;
create policy "posts owner insert" on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "posts owner delete" on public.posts;
create policy "posts owner delete" on public.posts for delete using (auth.uid() = user_id);

-- likes
drop policy if exists "likes public read" on public.likes;
create policy "likes public read" on public.likes for select using (true);
drop policy if exists "likes owner write" on public.likes;
create policy "likes owner write" on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reposts
drop policy if exists "reposts public read" on public.reposts;
create policy "reposts public read" on public.reposts for select using (true);
drop policy if exists "reposts owner write" on public.reposts;
create policy "reposts owner write" on public.reposts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- follows
drop policy if exists "follows public read" on public.follows;
create policy "follows public read" on public.follows for select using (true);
drop policy if exists "follows owner write" on public.follows;
create policy "follows owner write" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- ── handy counts view ──
create or replace view public.post_stats as
select
  p.id as post_id,
  (select count(*) from public.likes l where l.post_id = p.id) as like_count,
  (select count(*) from public.reposts r where r.post_id = p.id) as repost_count
from public.posts p;
