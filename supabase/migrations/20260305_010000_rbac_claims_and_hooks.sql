-- ============================================================================
-- RBAC Phase 1 (single-role) + Supabase custom access token hook
-- Date: 2026-03-04
--
-- This migration does three things:
-- 1) Normalizes and validates user_profiles.role values.
-- 2) Adds JWT helper functions for role checks in RLS.
-- 3) Adds custom_access_token_hook for GoTrue custom JWT claims.
--
-- Self-hosted auth setup (outside this SQL file):
--   GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true
--   GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token_hook
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1) Normalize role values to supported set
-- --------------------------------------------------------------------------
UPDATE public.user_profiles
SET role = 'siswa'
WHERE role IS NULL
   OR role NOT IN ('admin', 'kepala_sekolah', 'guru', 'wali_kelas', 'siswa');

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'kepala_sekolah', 'guru', 'wali_kelas', 'siswa'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_role_v2 ON public.user_profiles(role);

-- --------------------------------------------------------------------------
-- 2) JWT claim helpers for RLS
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    CASE
      WHEN auth.jwt() ->> 'role' IN ('admin', 'kepala_sekolah', 'guru', 'wali_kelas', 'siswa')
        THEN auth.jwt() ->> 'role'
      ELSE NULL
    END,
    'siswa'
  );
$$;

CREATE OR REPLACE FUNCTION public.app_has_any_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.app_role() = ANY(roles);
$$;

COMMENT ON FUNCTION public.app_role IS 'Returns role from JWT claims with default fallback to siswa.';
COMMENT ON FUNCTION public.app_has_any_role IS 'Checks whether current JWT role belongs to any role in provided array.';

-- --------------------------------------------------------------------------
-- 3) Supabase custom access token hook (GoTrue pg-functions URI)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  resolved_role text;
BEGIN
  SELECT COALESCE(up.role, 'siswa')
    INTO resolved_role
  FROM public.user_profiles up
  WHERE up.user_id = (event ->> 'user_id')::uuid
  LIMIT 1;

  claims := COALESCE(event -> 'claims', '{}'::jsonb);

  claims := jsonb_set(
    claims,
    '{app_metadata,role}',
    to_jsonb(COALESCE(resolved_role, 'siswa')),
    true
  );

  claims := jsonb_set(
    claims,
    '{app_metadata,roles}',
    jsonb_build_array(COALESCE(resolved_role, 'siswa')),
    true
  );

  event := jsonb_set(event, '{claims}', claims, true);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated, public;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON TABLE public.user_profiles TO supabase_auth_admin;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='user_profiles'
      AND policyname='user_profiles_hook_read_auth_admin'
  ) THEN
    CREATE POLICY user_profiles_hook_read_auth_admin ON public.user_profiles
      AS PERMISSIVE
      FOR SELECT
      TO supabase_auth_admin
      USING (true);
  END IF;
END $$;

COMMENT ON FUNCTION public.custom_access_token_hook IS 'Supabase custom access token hook that injects role + roles claims from user_profiles.';

-- --------------------------------------------------------------------------
-- 4) RLS policies: claim-based privileged access
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='absences' AND policyname='absences_privileged_manage'
  ) THEN
    CREATE POLICY absences_privileged_manage ON public.absences
      FOR ALL
      USING (public.app_has_any_role(ARRAY['admin','kepala_sekolah','guru','wali_kelas']))
      WITH CHECK (public.app_has_any_role(ARRAY['admin','kepala_sekolah','guru','wali_kelas']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='perizinan' AND policyname='perizinan_privileged_manage'
  ) THEN
    CREATE POLICY perizinan_privileged_manage ON public.perizinan
      FOR ALL
      USING (public.app_has_any_role(ARRAY['admin','kepala_sekolah','guru','wali_kelas']))
      WITH CHECK (public.app_has_any_role(ARRAY['admin','kepala_sekolah','guru','wali_kelas']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_privileged_read'
  ) THEN
    CREATE POLICY user_profiles_privileged_read ON public.user_profiles
      FOR SELECT
      USING (public.app_has_any_role(ARRAY['admin','kepala_sekolah','guru','wali_kelas']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='biodata_siswa' AND policyname='biodata_siswa_privileged_read'
  ) THEN
    CREATE POLICY biodata_siswa_privileged_read ON public.biodata_siswa
      FOR SELECT
      USING (public.app_has_any_role(ARRAY['admin','kepala_sekolah','guru','wali_kelas']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='location' AND policyname='location_admin_manage_by_claim'
  ) THEN
    CREATE POLICY location_admin_manage_by_claim ON public.location
      FOR ALL
      USING (public.app_has_any_role(ARRAY['admin','kepala_sekolah']))
      WITH CHECK (public.app_has_any_role(ARRAY['admin','kepala_sekolah']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='jadwal_absensi' AND policyname='jadwal_admin_manage_by_claim'
  ) THEN
    CREATE POLICY jadwal_admin_manage_by_claim ON public.jadwal_absensi
      FOR ALL
      USING (public.app_has_any_role(ARRAY['admin','kepala_sekolah']))
      WITH CHECK (public.app_has_any_role(ARRAY['admin','kepala_sekolah']));
  END IF;
END $$;

COMMIT;
