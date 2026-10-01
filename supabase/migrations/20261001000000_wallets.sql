-- OrbitX Mobile: self-custody wallet addresses (PUBLIC DATA ONLY — no key material, ever)
--
-- Design: private keys/mnemonic live ONLY in Expo SecureStore on the user's
-- device (iOS Keychain / Android Keystore). This table stores public
-- addresses so the backend can do balance/portfolio lookups. There is no
-- column for keys, seeds, or ciphertext — nothing to leak.

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null
    check (chain in ('ethereum', 'base', 'robinhood', 'arc', 'solana')),
  address text not null,
  created_at timestamptz not null default now(),
  unique (user_id, chain)
);

create index if not exists wallets_user_id_idx on public.wallets (user_id);

alter table public.wallets enable row level security;

drop policy if exists "Users read own wallet addresses" on public.wallets;
create policy "Users read own wallet addresses"
  on public.wallets for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own wallet addresses" on public.wallets;
create policy "Users insert own wallet addresses"
  on public.wallets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own wallet addresses" on public.wallets;
create policy "Users update own wallet addresses"
  on public.wallets for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own wallet addresses" on public.wallets;
create policy "Users delete own wallet addresses"
  on public.wallets for delete
  using (auth.uid() = user_id);
