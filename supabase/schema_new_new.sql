-- Supabase schema tailored for skanida-apps-mobile
-- Run in Supabase SQL Editor. Designed to be idempotent where possible.

-- =====================
-- Extensions
-- =====================
create extension if not exists pgcrypto;

-- =====================
-- Tables
-- =====================

-- user_profiles
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  email text,
  absence_number text,
  class_name text,
  avatar_url text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_user_id_idx on public.user_profiles(user_id);

-- Ensure app-specific fields exist
alter table public.user_profiles
  add column if not exists nis text,
  add column if not exists gender text;

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_user_profiles_updated_at') then
    create trigger set_user_profiles_updated_at
      before update on public.user_profiles
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- absences
-- App expects columns: user_id, date (YYYY-MM-DD), status ('Hadir' or 'Pulang'), reason, photo_url, latitude, longitude, created_at
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

-- perizinan
-- App expects: user_id, tanggal (timestamptz), kategori_izin ('sakit'|'pergi'), deskripsi, link_foto, status (boolean), created_at
-- Also keep extended moderation fields for future (approval_status, approved_by, etc.)
create table if not exists public.perizinan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tanggal timestamptz not null default now(),
  kategori_izin text not null check (kategori_izin in ('sakit','pergi')),
  deskripsi text,
  link_foto text,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  status boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  rejected_at timestamptz,
  rejected_by text
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'perizinan_approved_by_fkey'
  ) then
    alter table public.perizinan
      add constraint perizinan_approved_by_fkey foreign key (approved_by) references auth.users(id);
  end if;
end$$;

create index if not exists perizinan_user_tanggal_idx on public.perizinan(user_id, tanggal desc);

-- Store UTC date to enforce one izin per day per user
alter table public.perizinan add column if not exists tanggal_utc_date date;

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
  if not exists (select 1 from pg_trigger where tgname = 'set_perizinan_utc_date') then
    create trigger set_perizinan_utc_date
      before insert or update of tanggal on public.perizinan
      for each row execute function public.perizinan_set_utc_date();
  end if;
end$$;

-- backfill once (safe)
update public.perizinan set tanggal_utc_date = (tanggal at time zone 'UTC')::date where tanggal_utc_date is null;

create unique index if not exists perizinan_user_day_unique on public.perizinan(user_id, tanggal_utc_date);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_perizinan_updated_at') then
    create trigger set_perizinan_updated_at
      before update on public.perizinan
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- =====================================================
-- Additional: biodata_siswa table
-- =====================================================

create table if not exists public.biodata_siswa (
  nis bigint primary key,
  nama text,
  kelas text,
  absen int,
  kelamin text,
  activated boolean not null default false
);

-- RLS enabled; no direct select policy to enforce access via RPC only
alter table public.biodata_siswa enable row level security;

-- =====================
-- Row Level Security (RLS)
-- =====================

alter table public.user_profiles enable row level security;
alter table public.absences enable row level security;
alter table public.perizinan enable row level security;

-- user_profiles policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_select_own'
  ) then
    create policy user_profiles_select_own on public.user_profiles for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_insert_own'
  ) then
    create policy user_profiles_insert_own on public.user_profiles for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_update_own'
  ) then
    create policy user_profiles_update_own on public.user_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- absences policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='absences' and policyname='absences_select_own'
  ) then
    create policy absences_select_own on public.absences for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='absences' and policyname='absences_insert_own'
  ) then
    create policy absences_insert_own on public.absences for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='absences' and policyname='absences_update_own'
  ) then
    create policy absences_update_own on public.absences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- perizinan policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='perizinan' and policyname='perizinan_select_own'
  ) then
    create policy perizinan_select_own on public.perizinan for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='perizinan' and policyname='perizinan_insert_own'
  ) then
    create policy perizinan_insert_own on public.perizinan for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='perizinan' and policyname='perizinan_update_own'
  ) then
    create policy perizinan_update_own on public.perizinan for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- =====================
-- Storage buckets & policies
-- =====================

-- Postgres-only friendly storage setup (merged from storage_setup_postgres_role.sql)
-- This block avoids SET ROLE and catches insufficient privileges, guiding to use Studio if needed.
DO $$
DECLARE
  has_create_bucket boolean;
BEGIN
  -- Detect helper function storage.create_bucket
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'storage' AND p.proname = 'create_bucket'
  ) INTO has_create_bucket;

  -- attendance-photos
  BEGIN
    IF has_create_bucket THEN
      PERFORM storage.create_bucket('attendance-photos', false);
    ELSE
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('attendance-photos','attendance-photos', false)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Insufficient privilege to create bucket attendance-photos. Create it via Studio (private).';
    WHEN others THEN
      RAISE NOTICE 'Skipping attendance-photos bucket creation: %', SQLERRM;
  END;

  -- perizinan
  BEGIN
    IF has_create_bucket THEN
      PERFORM storage.create_bucket('perizinan', false);
    ELSE
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('perizinan','perizinan', false)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Insufficient privilege to create bucket perizinan. Create it via Studio (private).';
    WHEN others THEN
      RAISE NOTICE 'Skipping perizinan bucket creation: %', SQLERRM;
  END;

  -- avatars
  BEGIN
    IF has_create_bucket THEN
      PERFORM storage.create_bucket('avatars', false);
    ELSE
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('avatars','avatars', false)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Insufficient privilege to create bucket avatars. Create it via Studio (private).';
    WHEN others THEN
      RAISE NOTICE 'Skipping avatars bucket creation: %', SQLERRM;
  END;

  -- Enforce private buckets
  BEGIN
    UPDATE storage.buckets
      SET public = false
      WHERE id IN ('attendance-photos','perizinan','avatars')
        AND public IS DISTINCT FROM false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Cannot set buckets to private; set privacy in Studio UI.';
    WHEN others THEN
      RAISE NOTICE 'Update bucket privacy skipped: %', SQLERRM;
  END;

  -- Ensure RLS enabled on storage.objects
  BEGIN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Cannot enable RLS on storage.objects; likely already enabled or requires owner. Check in Studio.';
    WHEN others THEN
      RAISE NOTICE 'Enable RLS skipped: %', SQLERRM;
  END;

  -- Owner read policies
  BEGIN
    EXECUTE $pol$CREATE POLICY owner_read_attendance_photos ON storage.objects FOR SELECT USING (bucket_id = 'attendance-photos' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_read_attendance_photos denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_read_attendance_photos skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_read_perizinan ON storage.objects FOR SELECT USING (bucket_id = 'perizinan' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_read_perizinan denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_read_perizinan skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_read_avatars ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_read_avatars denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_read_avatars skipped: %', SQLERRM;
  END;

  -- Authenticated upload policies
  BEGIN
    EXECUTE $pol$CREATE POLICY auth_upload_attendance_photos ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attendance-photos' AND auth.role() = 'authenticated')$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy auth_upload_attendance_photos denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy auth_upload_attendance_photos skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY auth_upload_perizinan ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'perizinan' AND auth.role() = 'authenticated')$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy auth_upload_perizinan denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy auth_upload_perizinan skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY auth_upload_avatars ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated')$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy auth_upload_avatars denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy auth_upload_avatars skipped: %', SQLERRM;
  END;

  -- Owner update/delete policies (attendance-photos)
  BEGIN
    EXECUTE $pol$CREATE POLICY owner_update_delete_attendance_photos ON storage.objects FOR UPDATE USING (bucket_id = 'attendance-photos' AND owner = auth.uid()) WITH CHECK (bucket_id = 'attendance-photos' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_update_delete_attendance_photos denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_update_delete_attendance_photos skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_delete_attendance_photos ON storage.objects FOR DELETE USING (bucket_id = 'attendance-photos' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_delete_attendance_photos denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_delete_attendance_photos skipped: %', SQLERRM;
  END;

  -- Owner update/delete policies (perizinan)
  BEGIN
    EXECUTE $pol$CREATE POLICY owner_update_delete_perizinan ON storage.objects FOR UPDATE USING (bucket_id = 'perizinan' AND owner = auth.uid()) WITH CHECK (bucket_id = 'perizinan' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_update_delete_perizinan denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_update_delete_perizinan skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_delete_perizinan ON storage.objects FOR DELETE USING (bucket_id = 'perizinan' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_delete_perizinan denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_delete_perizinan skipped: %', SQLERRM;
  END;

  -- Owner update/delete policies (avatars)
  BEGIN
    EXECUTE $pol$CREATE POLICY owner_update_delete_avatars ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND owner = auth.uid()) WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_update_delete_avatars denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_update_delete_avatars skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_delete_avatars ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_delete_avatars denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN others THEN RAISE NOTICE 'Policy owner_delete_avatars skipped: %', SQLERRM;
  END;

END $$;

-- =====================
-- Grants
-- =====================
grant usage on schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;

grant select, insert, update, delete on table public.user_profiles to anon, authenticated;
grant select, insert, update, delete on table public.absences to anon, authenticated;
grant select, insert, update, delete on table public.perizinan to anon, authenticated;
grant select, insert, update, delete on table storage.objects to anon, authenticated;

-- Default privileges (best effort)
do $$
begin
  begin
    alter default privileges for role postgres in schema public
      grant select, insert, update, delete on tables to anon, authenticated;
  exception when others then null;
  end;
end$$;

-- =====================
-- Automatic User Profile Creation
-- =====================

-- Function to be called by a trigger when a new user signs up.
-- It creates a corresponding user_profile and links it to biodata_siswa.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_nis_text text;
  user_nis_bigint bigint;
begin
  -- Extract NIS from the user's metadata
  user_nis_text := new.raw_user_meta_data->>'nis';
  user_nis_bigint := user_nis_text::bigint;

  -- Create a new user profile by joining with biodata_siswa
  insert into public.user_profiles (user_id, full_name, email, nis, class_name, absence_number, gender, role)
  select
    new.id,
    bs.nama,
    new.email,
    bs.nis::text,
    bs.kelas,
    bs.absen::text,
    bs.kelamin,
    'siswa' -- Assign a default role
  from public.biodata_siswa as bs
  where bs.nis = user_nis_bigint;

  -- Mark the student's biodata as activated
  update public.biodata_siswa
  set activated = true
  where nis = user_nis_bigint;

  return new;
end;
$$;

-- Trigger to call the function after a new user is created in auth.users
-- This ensures the profile is created automatically upon signup.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end$$;

-- =====================
-- RPC Functions
-- =====================

-- Function to securely get student biodata for activation check
create or replace function public.get_biodata_siswa(p_nis text)
returns table (nama text, nis text, kelas text, activated boolean)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select
    bs.nama,
    bs.nis::text,
    bs.kelas,
    bs.activated
  from public.biodata_siswa as bs
  where bs.nis = p_nis::bigint;
end;
$$;

-- Grant execute permission to the anon role so it can be called without login
grant execute on function public.get_biodata_siswa(text) to anon;

-- End of schema

