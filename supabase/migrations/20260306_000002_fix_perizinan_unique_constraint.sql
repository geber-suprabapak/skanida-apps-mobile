-- ============================================================================
-- Migration: Fix perizinan unique constraint to allow multiple rejections
-- ============================================================================
-- Purpose: Modify the UNIQUE INDEX on perizinan(user_id, tanggal_utc_date) to
-- a partial unique index that only enforces uniqueness for pending/approved
-- submissions. This allows users to resubmit up to 3 times per day when
-- previous submissions are rejected, matching the application's business logic.
--
-- Before: Any second submission on the same day fails with "duplicate key" error
-- After: Only one "pending" OR "approved" per day is allowed; "rejected" records
--        don't block new submissions
-- ============================================================================

-- Drop the existing full unique index
DROP INDEX IF EXISTS perizinan_user_day_unique;

-- Create a partial unique index that only enforces uniqueness for active submissions
CREATE UNIQUE INDEX perizinan_user_day_unique 
  ON perizinan(user_id, tanggal_utc_date) 
  WHERE approval_status IN ('pending', 'approved');

-- Add comment for documentation
COMMENT ON INDEX perizinan_user_day_unique IS 'Partial unique index: enforces one pending or approved perizinan per user per day. Rejected submissions are not constrained, allowing up to 3 resubmissions per day.';
