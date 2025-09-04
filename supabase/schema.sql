-- skanida-apps-mobile schema for a fresh Supabase project
-- Apply this in Supabase SQL editor or psql. Idempotent where practical.

-- Extensions
create extension if not exists pgcrypto;

-- ==============
-- Auth reference
-- ==============
-- Supabase provides schema auth with table auth.users
-- We'll reference it via foreign keys

-- ==============
-- Tables
-- ==============

-- 1) user_profiles
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  email text,
  absence_number text,
  class_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additional column from old schema
alter table public.user_profiles
  add column if not exists role text;

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_user_profiles_updated_at'
  ) then
    create trigger set_user_profiles_updated_at
      before update on public.user_profiles
      for each row execute function public.set_updated_at();
  end if;
end$$;

create index if not exists user_profiles_user_id_idx on public.user_profiles(user_id);

-- 2) absences
-- Notes:
-- - status values used by app: 'Hadir', 'Datang', 'Pulang'
-- - date is compared as yyyy-mm-dd; use DATE type
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  status text not null check (status in ('Hadir','Datang','Pulang')),
  reason text,
  photo_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index if not exists absences_user_date_idx on public.absences(user_id, date);
create index if not exists absences_user_created_idx on public.absences(user_id, created_at desc);

-- 3) perizinan
-- Notes:
-- - kategori_izin: 'sakit' | 'pergi'
-- - approval_status: 'pending' | 'approved' | 'rejected'
-- - status: boolean (app reads and inserts, default false)
create table if not exists public.perizinan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tanggal timestamptz not null default now(),
  kategori_izin text not null check (kategori_izin in ('sakit','pergi')),
  deskripsi text,
  link_foto text,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  status boolean not null default false,
  created_at timestamptz not null default now()
);

-- Add missing columns from old schema (idempotent)
alter table public.perizinan
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by text;

-- Safe foreign key for approved_by -> auth.users(id)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'perizinan_approved_by_fkey'
  ) then
    alter table public.perizinan
      add constraint perizinan_approved_by_fkey foreign key (approved_by) references auth.users(id);
  end if;
end$$;

create index if not exists perizinan_user_tanggal_idx on public.perizinan(user_id, tanggal desc);

-- One perizinan per user per day using a stored UTC date column (safe for unique index)
alter table public.perizinan
  add column if not exists tanggal_utc_date date;

create or replace function public.perizinan_set_utc_date()
returns trigger language plpgsql as $$
begin
  if new.tanggal is null then
    new.tanggal := now();
  end if;
  new.tanggal_utc_date := (new.tanggal at time zone 'UTC')::date;
  return new;
end;$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_perizinan_utc_date'
  ) then
    create trigger set_perizinan_utc_date
      before insert or update of tanggal on public.perizinan
      for each row execute function public.perizinan_set_utc_date();
  end if;
end$$;

-- Backfill existing rows once
update public.perizinan
  set tanggal_utc_date = (tanggal at time zone 'UTC')::date
  where tanggal_utc_date is null;

-- Enforce one per day per user
create unique index if not exists perizinan_user_day_unique
  on public.perizinan (user_id, tanggal_utc_date);

-- Keep perizinan.updated_at fresh on updates (reuse public.set_updated_at)
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_perizinan_updated_at'
  ) then
    create trigger set_perizinan_updated_at
      before update on public.perizinan
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- ==============
-- Row Level Security (RLS)
-- ==============

-- user_profiles
alter table public.user_profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_select_own'
  ) then
    create policy user_profiles_select_own
      on public.user_profiles for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_insert_own'
  ) then
    create policy user_profiles_insert_own
      on public.user_profiles for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_update_own'
  ) then
    create policy user_profiles_update_own
      on public.user_profiles for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- absences
alter table public.absences enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='absences' and policyname='absences_select_own'
  ) then
    create policy absences_select_own
      on public.absences for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='absences' and policyname='absences_insert_own'
  ) then
    create policy absences_insert_own
      on public.absences for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='absences' and policyname='absences_update_own'
  ) then
    create policy absences_update_own
      on public.absences for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- perizinan
alter table public.perizinan enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='perizinan' and policyname='perizinan_select_own'
  ) then
    create policy perizinan_select_own
      on public.perizinan for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='perizinan' and policyname='perizinan_insert_own'
  ) then
    create policy perizinan_insert_own
      on public.perizinan for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='perizinan' and policyname='perizinan_update_own'
  ) then
    create policy perizinan_update_own
      on public.perizinan for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ==============
-- Storage: Buckets and Policies
-- ==============

-- Create buckets if not exist
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'attendance-photos') then
    insert into storage.buckets (id, name, public)
    values ('attendance-photos', 'attendance-photos', false);
  end if;
  if not exists (select 1 from storage.buckets where id = 'perizinan') then
    insert into storage.buckets (id, name, public)
    values ('perizinan', 'perizinan', false);
  end if;
  if not exists (select 1 from storage.buckets where id = 'avatars') then
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', false);
  end if;
end$$;

-- Enforce privacy on existing buckets too
update storage.buckets
  set public = false
  where id in ('attendance-photos','perizinan','avatars')
    and public is distinct from false;

-- Ensure RLS is enabled on storage.objects
alter table storage.objects enable row level security;

-- Private buckets: remove any public read policies and allow only owners to read
do $$ begin
  if exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='public_read_attendance_photos'
  ) then
    drop policy public_read_attendance_photos on storage.objects;
  end if;
  if exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='public_read_perizinan'
  ) then
    drop policy public_read_perizinan on storage.objects;
  end if;
  if exists (
    select 1 from pg_policies where s chemaname='storage' and tablename='objects' and policyname='public_read_avatars'
  ) then
    drop policy public_read_avatars on storage.objects;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='owner_read_attendance_photos'
  ) then
    create policy owner_read_attendance_photos
      on storage.objects for select
      using (bucket_id = 'attendance-photos' and owner = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='owner_read_perizinan'
  ) then
    create policy owner_read_perizinan
      on storage.objects for select
      using (bucket_id = 'perizinan' and owner = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='owner_read_avatars'
  ) then
    create policy owner_read_avatars
      on storage.objects for select
      using (bucket_id = 'avatars' and owner = auth.uid());
  end if;
end $$;

-- Authenticated users can upload to these buckets
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='auth_upload_attendance_photos'
  ) then
    create policy auth_upload_attendance_photos
      on storage.objects for insert
      with check (bucket_id = 'attendance-photos' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='auth_upload_perizinan'
  ) then
    create policy auth_upload_perizinan
      on storage.objects for insert
      with check (bucket_id = 'perizinan' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='auth_upload_avatars'
  ) then
    create policy auth_upload_avatars
      on storage.objects for insert
      with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
  end if;
end $$;

-- Owners can update/delete their own storage objects
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='owner_update_delete_attendance_photos'
  ) then
    create policy owner_update_delete_attendance_photos
      on storage.objects for update using (bucket_id = 'attendance-photos' and owner = auth.uid())
      with check (bucket_id = 'attendance-photos' and owner = auth.uid());
    create policy owner_delete_attendance_photos
      on storage.objects for delete using (bucket_id = 'attendance-photos' and owner = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='owner_update_delete_perizinan'
  ) then
    create policy owner_update_delete_perizinan
      on storage.objects for update using (bucket_id = 'perizinan' and owner = auth.uid())
      with check (bucket_id = 'perizinan' and owner = auth.uid());
    create policy owner_delete_perizinan
      on storage.objects for delete using (bucket_id = 'perizinan' and owner = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='owner_update_delete_avatars'
  ) then
    create policy owner_update_delete_avatars
      on storage.objects for update using (bucket_id = 'avatars' and owner = auth.uid())
      with check (bucket_id = 'avatars' and owner = auth.uid());
    create policy owner_delete_avatars
      on storage.objects for delete using (bucket_id = 'avatars' and owner = auth.uid());
  end if;
end $$;

-- ==============
-- Helpful grants (ensure API role can access public schema)
-- Supabase manages grants for anon/authenticated automatically; this is a no-op in most cases.
grant usage on schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;

-- Explicit table privileges so RLS policies can apply for anon/authenticated roles
grant select, insert, update, delete on table public.user_profiles to anon, authenticated;
grant select, insert, update, delete on table public.absences to anon, authenticated;
grant select, insert, update, delete on table public.perizinan to anon, authenticated;

-- Storage objects table privileges (RLS still restricts access via policies above)
grant select, insert, update, delete on table storage.objects to anon, authenticated;

-- Future-proof: new tables created by postgres in public inherit these privileges
do $$
begin
  begin
    alter default privileges for role postgres in schema public
      grant select, insert, update, delete on tables to anon, authenticated;
  exception when others then
    -- ignore if role differs in this project; explicit grants above are sufficient
    null;
  end;
end$$;

-- End of schema
