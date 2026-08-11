-- Promote every student by one grade for the 2026 academic rollover.
--
-- Mapping:
--   X <major/class>   -> XI <major/class>
--   XI <major/class>  -> XII <major/class>
--   XII <major/class> -> Lulus
--
-- This is deliberately a one-time migration for the 2026 rollover. An audit
-- marker makes a manual second execution fail before any row changes while
-- preserving every original class value for an explicit rollback if needed.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('2026-2027-promote-students-one-grade'));

CREATE TABLE IF NOT EXISTS public.student_class_promotion_audit (
  promotion_key text NOT NULL,
  nis bigint NOT NULL,
  from_class text NOT NULL,
  to_class text NOT NULL,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_key, nis)
);

COMMENT ON TABLE public.student_class_promotion_audit IS
  'Immutable source values and execution marker for annual student class promotions.';

ALTER TABLE public.student_class_promotion_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_class_promotion_audit FROM anon, authenticated;

DO $$
DECLARE
  source_x_count bigint;
  source_xi_count bigint;
  source_xii_count bigint;
  expected_biodata_updates bigint;
  actual_biodata_updates bigint;
  actual_profile_updates bigint;
  actual_audit_inserts bigint;
  profiles_without_biodata bigint;
  profile_class_mismatches bigint;
  unsupported_classes text[];
BEGIN
  -- Abort instead of promoting the remaining XI/X population for a second
  -- time. Future rollovers use a different promotion_key.
  IF EXISTS (
    SELECT 1
    FROM public.student_class_promotion_audit
    WHERE promotion_key = '2026-2027-annual-rollover'
  ) THEN
    RAISE EXCEPTION
      'Class promotion aborted: promotion key 2026-2027-annual-rollover already exists';
  END IF;

  SELECT count(*) INTO profiles_without_biodata
  FROM public.user_profiles AS up
  LEFT JOIN public.biodata_siswa AS bs ON bs.nis::text = up.nis
  WHERE up.nis IS NOT NULL
    AND bs.nis IS NULL;

  IF profiles_without_biodata > 0 THEN
    RAISE EXCEPTION
      'Class promotion aborted: % user_profiles rows have no matching biodata_siswa row',
      profiles_without_biodata;
  END IF;

  SELECT count(*) INTO profile_class_mismatches
  FROM public.user_profiles AS up
  JOIN public.biodata_siswa AS bs ON bs.nis::text = up.nis
  WHERE up.class_name IS DISTINCT FROM bs.kelas;

  IF profile_class_mismatches > 0 THEN
    RAISE EXCEPTION
      'Class promotion aborted: % profile classes already differ from biodata_siswa',
      profile_class_mismatches;
  END IF;

  SELECT
    count(*) FILTER (WHERE kelas ~ '^X([[:space:]]|$)'),
    count(*) FILTER (WHERE kelas ~ '^XI([[:space:]]|$)'),
    count(*) FILTER (WHERE kelas ~ '^XII([[:space:]]|$)')
  INTO source_x_count, source_xi_count, source_xii_count
  FROM public.biodata_siswa;

  expected_biodata_updates := source_x_count + source_xi_count + source_xii_count;

  SELECT array_agg(DISTINCT kelas ORDER BY kelas)
  INTO unsupported_classes
  FROM public.biodata_siswa
  WHERE kelas IS NOT NULL
    AND btrim(kelas) <> ''
    AND kelas <> 'Guru'
    AND kelas !~ '^(X|XI|XII)([[:space:]]|$)';

  IF unsupported_classes IS NOT NULL THEN
    RAISE NOTICE 'Unchanged unsupported class labels: %', unsupported_classes;
  END IF;

  INSERT INTO public.student_class_promotion_audit (
    promotion_key,
    nis,
    from_class,
    to_class
  )
  SELECT
    '2026-2027-annual-rollover',
    nis,
    kelas,
    CASE
      WHEN kelas ~ '^XII([[:space:]]|$)' THEN 'Lulus'
      WHEN kelas ~ '^XI([[:space:]]|$)' THEN regexp_replace(kelas, '^XI', 'XII')
      WHEN kelas ~ '^X([[:space:]]|$)' THEN regexp_replace(kelas, '^X', 'XI')
    END
  FROM public.biodata_siswa
  WHERE kelas ~ '^(X|XI|XII)([[:space:]]|$)';

  GET DIAGNOSTICS actual_audit_inserts = ROW_COUNT;

  IF actual_audit_inserts <> expected_biodata_updates THEN
    RAISE EXCEPTION
      'Class promotion aborted: expected % audit rows but inserted %',
      expected_biodata_updates,
      actual_audit_inserts;
  END IF;

  UPDATE public.biodata_siswa AS bs
  SET kelas = audit.to_class
  FROM public.student_class_promotion_audit AS audit
  WHERE audit.promotion_key = '2026-2027-annual-rollover'
    AND audit.nis = bs.nis
    AND bs.kelas IS DISTINCT FROM audit.to_class;

  GET DIAGNOSTICS actual_biodata_updates = ROW_COUNT;

  IF actual_biodata_updates <> expected_biodata_updates THEN
    RAISE EXCEPTION
      'Class promotion aborted: expected % biodata updates but updated %',
      expected_biodata_updates,
      actual_biodata_updates;
  END IF;

  -- biodata_siswa is the source of truth. Synchronize every activated profile
  -- by NIS rather than repeating the prefix transformation independently.
  UPDATE public.user_profiles AS up
  SET class_name = bs.kelas,
      updated_at = now()
  FROM public.biodata_siswa AS bs
  WHERE bs.nis::text = up.nis
    AND up.class_name IS DISTINCT FROM bs.kelas;

  GET DIAGNOSTICS actual_profile_updates = ROW_COUNT;

  SELECT count(*) INTO profile_class_mismatches
  FROM public.user_profiles AS up
  JOIN public.biodata_siswa AS bs ON bs.nis::text = up.nis
  WHERE up.class_name IS DISTINCT FROM bs.kelas;

  IF profile_class_mismatches > 0 THEN
    RAISE EXCEPTION
      'Class promotion aborted: % profile classes differ after synchronization',
      profile_class_mismatches;
  END IF;

  RAISE NOTICE
    'Class promotion complete: X=% XI=% XII=%; biodata updated=%; profiles synchronized=%',
    source_x_count,
    source_xi_count,
    source_xii_count,
    actual_biodata_updates,
    actual_profile_updates;
END;
$$;

COMMIT;
