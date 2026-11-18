-- Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
-- Every table is locked to the logged-in user with Row Level Security,
-- so the public "anon" key in the website cannot read anyone's data without logging in.

-- One row per user: company details, billing rules, trip-type definitions, next invoice number.
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Vehicle types and their rates (add / edit / delete from the Rates screen).
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  local_pkg numeric, local_hr numeric, local_km numeric,
  air_pkg numeric,   air_hr numeric,   air_km numeric,
  hill numeric, out_km numeric, driver numeric,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  address text not null default '',
  gstin text not null default '',
  created_at timestamptz not null default now()
);

-- Saved bills. The full bill (trips, the rates used, client details) is kept in "data".
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invoice_no text not null,
  bill_date date,
  client_name text not null default '',
  grand_total numeric not null default 0,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bills_user_created_idx on public.bills (user_id, created_at desc);

alter table public.settings enable row level security;
alter table public.vehicles enable row level security;
alter table public.clients  enable row level security;
alter table public.bills    enable row level security;

drop policy if exists "own settings" on public.settings;
drop policy if exists "own vehicles" on public.vehicles;
drop policy if exists "own clients"  on public.clients;
drop policy if exists "own bills"    on public.bills;

create policy "own settings" on public.settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own vehicles" on public.vehicles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own clients"  on public.clients  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own bills"    on public.bills    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
