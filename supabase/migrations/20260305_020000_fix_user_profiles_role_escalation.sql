-- ============================================================================
-- Security Fix: Prevent role self-escalation via user_profiles updates
-- Date: 2026-03-04
--
-- Problem:
-- - authenticated users could update their own user_profiles row
-- - role claim hook reads user_profiles.role directly
-- - changing own role to admin escalates privileges on next token refresh
--
-- Fix strategy:
-- 1) Restrict authenticated update privilege to non-sensitive columns only.
-- 2) Harden own-update RLS policy with immutable role check.
-- ============================================================================

BEGIN;

-- Harden role helper fallback semantics.
-- Ignore generic Supabase auth role claims (anon/authenticated) and use siswa default.
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

-- Remove broad UPDATE table privilege for client roles.
REVOKE UPDATE ON TABLE public.user_profiles FROM anon, authenticated;

-- Allow updates only to non-privileged profile columns.
GRANT UPDATE (
  nis,
  full_name,
  email,
  avatar_url,
  absence_number,
  class_name,
  gender,
  updated_at
) ON TABLE public.user_profiles TO anon, authenticated;

-- Recreate own-update policy with role immutability.
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;

CREATE POLICY user_profiles_update_own
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (
    SELECT up.role
    FROM public.user_profiles AS up
    WHERE up.user_id = auth.uid()
    LIMIT 1
  )
);

COMMIT;
