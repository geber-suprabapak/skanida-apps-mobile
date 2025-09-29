-- Nuke script for Supabase (use with caution)
-- Run in Supabase SQL editor. Execute only the section you need.
-- After nuking, re-apply your schema with supabase/schema.sql.

-- =======================================
-- SAFETY: Run inside a transaction if desired
-- begin; -- uncomment to run in a transaction
-- rollback; -- keep this commented to commit, or run to undo during testing
-- =======================================

-- ---------------------------------------
-- OPTION A: SOFT RESET (Keep tables + policies; delete all rows and storage objects)
-- ---------------------------------------
-- This preserves table definitions, RLS, and indexes. It removes data only.
-- Execute this section if you simply want a clean database and empty storage.

-- 1) Truncate app tables (adjust if you add new tables)
truncate table public.absences restart identity cascade;
truncate table public.perizinan restart identity cascade;
truncate table public.user_profiles restart identity cascade;

-- 2) Empty storage buckets used by the app (safe if bucket exists)
do $$
begin
  if exists (select 1 from storage.buckets where id = 'attendance-photos') then
    delete from storage.objects where bucket_id = 'attendance-photos';
  end if;
  if exists (select 1 from storage.buckets where id = 'perizinan') then
    delete from storage.objects where bucket_id = 'perizinan';
  end if;
  if exists (select 1 from storage.buckets where id = 'avatars') then
    delete from storage.objects where bucket_id = 'avatars';
  end if;
end $$;

-- ---------------------------------------
-- OPTION B: DROP AND RECREATE PUBLIC SCHEMA (Hard reset of app objects)
-- ---------------------------------------
-- This drops everything in public (tables, views, functions, policies, extensions in public).
-- It DOES NOT drop auth/storage schemas. After this, re-run supabase/schema.sql.

-- WARNING: Uncomment to execute
 drop schema public cascade;
  create schema public;
 grant usage on schema public to anon, authenticated;
-- -- Recreate extensions you need in public
 create extension if not exists pgcrypto;

-- After running the above, re-apply app schema (manually run supabase/schema.sql)

-- ---------------------------------------
-- OPTION C: NUKE STORAGE BUCKETS (remove and recreate)
-- ---------------------------------------
-- If buckets get into a bad state, delete and recreate them.

-- 1) Empty then delete buckets if they exist
do $$
begin
  if exists (select 1 from storage.buckets where id = 'attendance-photos') then
    delete from storage.objects where bucket_id = 'attendance-photos';
    delete from storage.buckets where id = 'attendance-photos';
  end if;
  if exists (select 1 from storage.buckets where id = 'perizinan') then
    delete from storage.objects where bucket_id = 'perizinan';
    delete from storage.buckets where id = 'perizinan';
  end if;
  if exists (select 1 from storage.buckets where id = 'avatars') then
    delete from storage.objects where bucket_id = 'avatars';
    delete from storage.buckets where id = 'avatars';
  end if;
end $$;

-- 2) Recreate buckets (private)
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
end $$;

-- Note: If you dropped public (Option B), re-run supabase/schema.sql to restore
-- storage policies (RLS on storage.objects) and table schemas.
