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
  day_rent numeric, fuel_cost_per_km numeric,
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
  -- URL of the optional ZIP attachment stored in Supabase Storage
  attachment_url text not null default '',
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

-- ============================================================
-- MIGRATION: run only if the bills table already exists
-- (safe to run even on a fresh database — the column is in the
--  CREATE TABLE above, so this is a no-op for new installs).
-- ============================================================
alter table public.bills add column if not exists attachment_url text not null default '';

-- ============================================================
-- MIGRATION: add day_rent column to vehicles (safe on existing DBs)
-- ============================================================
alter table public.vehicles add column if not exists day_rent numeric;

-- ============================================================
-- MIGRATION: add fuel_cost_per_km column to vehicles
-- ============================================================
alter table public.vehicles add column if not exists fuel_cost_per_km numeric;

-- ============================================================
-- Storage bucket for ZIP attachments
-- ============================================================
-- 1. Create the bucket. It is public because the app stores getPublicUrl()
--    URLs for saved attachments. Rerunning this migration also repairs a
--    previously-created private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bill-attachments',
  'bill-attachments',
  true,
  52428800,                     -- 50 MB max per file
  array['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
on conflict (id) do update set
  name = excluded.name,
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. RLS policies on storage objects so each user can only touch their own files.
--    Files are stored as "<authenticated-user-id>/<bill-id>.<ext>".

drop policy if exists "auth upload attachment"  on storage.objects;
drop policy if exists "auth read attachment"    on storage.objects;
drop policy if exists "auth delete attachment"  on storage.objects;

create policy "auth upload attachment"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bill-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "auth read attachment"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bill-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "auth delete attachment"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bill-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Supabase hosts normally grant these automatically, but explicit grants make
-- rerunning this schema safe after a project was created with restricted defaults.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.bills to authenticated;
