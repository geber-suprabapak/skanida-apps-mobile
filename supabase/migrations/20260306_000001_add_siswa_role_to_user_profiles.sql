-- Migration: Add siswa role to all existing user_profiles
-- Purpose: Populate role field for all existing records in user_profiles table
-- Date: 2026-03-06

BEGIN;

-- Update all user_profiles records that have NULL role to 'siswa'
UPDATE public.user_profiles
SET role = 'siswa'
WHERE role IS NULL;

-- Log the number of records updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM public.user_profiles WHERE role = 'siswa';
  RAISE NOTICE 'Total Records in user_profiles: %', updated_count;
END $$;

COMMIT;
