-- OrbitX Mobile tables on the shared habla project.
-- ALL tables prefixed om_ to avoid colliding with habla's tutor tables
-- (conversations, messages, scout_voice_messages).
--
-- Design notes:
--  * om_wallets stores PUBLIC ADDRESSES ONLY. No key material, ever.
--    Keys live in Expo SecureStore on the device.
--  * om_launches tracks pump.fun launches for the "recently launched" feed.
--    Each launch also auto-posts an om_posts row with the $CASHTAG.

-- ── wallets (addresses only) ──
create table if not exists public.om_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null
    check (chain in ('ethereum', 'base', 'robinhood', 'arc', 'solana')),
  address text not null,
  created_at timestamptz not null default now(),
  unique (user_id, chain)
);
create index if not exists om_wallets_user_id_idx on public.om_wallets (user_id);
alter table public.om_wallets enable row level security;
drop policy if exists "om_wallets owner read" on public.om_wallets;
create policy "om_wallets owner read" on public.om_wallets for select using (auth.uid() = user_id);
drop policy if exists "om_wallets owner insert" on public.om_wallets;
create policy "om_wallets owner insert" on public.om_wallets for insert with check (auth.uid() = user_id);
drop policy if exists "om_wallets owner update" on public.om_wallets;
create policy "om_wallets owner update" on public.om_wallets for update using (auth.uid() = user_id);
drop policy if exists "om_wallets owner delete" on public.om_wallets;
create policy "om_wallets owner delete" on public.om_wallets for delete using (auth.uid() = user_id);

-- ── profiles ──
create table if not exists public.om_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-zA-Z0-9_]{1,30}$'),
  display_name text not null default '',
  avatar_url text,
  bio text default '',
  created_at timestamptz not null default now()
);
alter table public.om_profiles enable row level security;
drop policy if exists "om_profiles public read" on public.om_profiles;
create policy "om_profiles public read" on public.om_profiles for select using (true);
drop policy if exists "om_profiles owner insert" on public.om_profiles;
create policy "om_profiles owner insert" on public.om_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "om_profiles owner update" on public.om_profiles;
create policy "om_profiles owner update" on public.om_profiles for update using (auth.uid() = user_id);

-- ── posts ──
create table if not exists public.om_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  cashtags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists om_posts_created_idx on public.om_posts (created_at desc);
create index if not exists om_posts_user_idx on public.om_posts (user_id);
alter table public.om_posts enable row level security;
drop policy if exists "om_posts public read" on public.om_posts;
create policy "om_posts public read" on public.om_posts for select using (true);
drop policy if exists "om_posts owner insert" on public.om_posts;
create policy "om_posts owner insert" on public.om_posts for insert with check (auth.uid() = user_id);
drop policy if exists "om_posts owner delete" on public.om_posts;
create policy "om_posts owner delete" on public.om_posts for delete using (auth.uid() = user_id);

-- ── likes ──
create table if not exists public.om_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.om_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.om_likes enable row level security;
drop policy if exists "om_likes public read" on public.om_likes;
create policy "om_likes public read" on public.om_likes for select using (true);
drop policy if exists "om_likes owner write" on public.om_likes;
create policy "om_likes owner write" on public.om_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── reposts ──
create table if not exists public.om_reposts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.om_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.om_reposts enable row level security;
drop policy if exists "om_reposts public read" on public.om_reposts;
create policy "om_reposts public read" on public.om_reposts for select using (true);
drop policy if exists "om_reposts owner write" on public.om_reposts;
create policy "om_reposts owner write" on public.om_reposts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── follows ──
create table if not exists public.om_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.om_follows enable row level security;
drop policy if exists "om_follows public read" on public.om_follows;
create policy "om_follows public read" on public.om_follows for select using (true);
drop policy if exists "om_follows owner write" on public.om_follows;
create policy "om_follows owner write" on public.om_follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- ── launches (recently-launched feed tracking) ──
create table if not exists public.om_launches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.om_posts(id) on delete set null,
  mint text not null,
  name text not null,
  symbol text not null,
  pair text not null check (pair in ('sol', 'usdc')),
  signature text not null,
  dev_buy_signature text,
  vanity boolean not null default false,
  metadata_uri text,
  created_at timestamptz not null default now()
);
create index if not exists om_launches_created_idx on public.om_launches (created_at desc);
create index if not exists om_launches_mint_idx on public.om_launches (mint);
alter table public.om_launches enable row level security;
drop policy if exists "om_launches public read" on public.om_launches;
create policy "om_launches public read" on public.om_launches for select using (true);
drop policy if exists "om_launches owner insert" on public.om_launches;
create policy "om_launches owner insert" on public.om_launches for insert with check (auth.uid() = user_id);
