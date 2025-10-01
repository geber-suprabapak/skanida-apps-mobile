-- Attendance time validation functions and policies for Supabase
-- This file should be executed in the Supabase SQL editor

-- Function to check if a given timestamp is within allowed attendance hours
-- Returns boolean based on school schedule
CREATE OR REPLACE FUNCTION public.is_valid_attendance_time(
  check_time timestamptz,
  attendance_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_of_week integer;
  time_minutes integer;
  check_in_start integer;
  check_in_end integer;
  check_out_start integer;
  check_out_end integer;
BEGIN
  -- Extract day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  -- Convert to local timezone (Asia/Jakarta) before checking
  day_of_week := EXTRACT(DOW FROM check_time AT TIME ZONE 'Asia/Jakarta');
  
  -- Extract time in minutes from midnight
  time_minutes := EXTRACT(HOUR FROM check_time AT TIME ZONE 'Asia/Jakarta') * 60 + 
                  EXTRACT(MINUTE FROM check_time AT TIME ZONE 'Asia/Jakarta');
  
  -- Skip weekends (Saturday = 6, Sunday = 0)
  IF day_of_week = 0 OR day_of_week = 6 THEN
    RETURN false;
  END IF;
  
  -- Define schedule based on day of week (from actual school schedule)
  IF day_of_week = 1 THEN
    -- Monday (SENIN) - UPACARA starts at 07:00, classes until 15:15
    check_in_start := 7 * 60; -- 07:00
    check_in_end := 7 * 60 + 45;   -- 07:45
    check_out_start := 15 * 60; -- 15:00
    check_out_end := 16 * 60;   -- 16:00
  ELSIF day_of_week >= 2 AND day_of_week <= 4 THEN
    -- Tuesday - Thursday (SELASA, RABU, KAMIS) - Classes from 07:00 to 16:00
    check_in_start := 7 * 60; -- 07:00
    check_in_end := 7 * 60 + 45;   -- 07:45
    check_out_start := 15 * 60 + 15; -- 15:15
    check_out_end := 16 * 60;   -- 16:00
  ELSIF day_of_week = 5 THEN
    -- Friday (JUMAT) - Classes from 07:00 to 12:00
    check_in_start := 7 * 60; -- 07:00
    check_in_end := 7 * 60 + 45;   -- 07:45
    check_out_start := 11 * 60 + 30; -- 11:30
    check_out_end := 12 * 60;   -- 12:00
  ELSE
    RETURN false;
  END IF;
  
  -- Check if time is valid based on attendance status
  IF attendance_status IN ('Hadir', 'Datang') THEN
    -- Check-in validation
    RETURN time_minutes >= check_in_start AND time_minutes <= check_in_end;
  ELSIF attendance_status = 'Pulang' THEN
    -- Check-out validation
    RETURN time_minutes >= check_out_start AND time_minutes <= check_out_end;
  ELSE
    -- Unknown status
    RETURN false;
  END IF;
END;
$$;

-- Create a policy that validates attendance time for INSERT operations
-- First, drop the existing insert policy if it exists
DROP POLICY IF EXISTS "absences_insert_own" ON public.absences;

-- Create new policy that includes time validation
CREATE POLICY "absences_insert_with_time_validation"
ON public.absences
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND public.is_valid_attendance_time(created_at, status)
);

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_valid_attendance_time TO authenticated;

-- Add a comment to document the function
COMMENT ON FUNCTION public.is_valid_attendance_time IS 
'Validates if attendance can be recorded at the given time based on school schedule:
- Monday (SENIN): Check-in 07:00-07:45, Check-out 15:00-16:00
- Tuesday-Thursday (SELASA, RABU, KAMIS): Check-in 07:00-07:45, Check-out 15:15-16:00
- Friday (JUMAT): Check-in 07:00-07:45, Check-out 11:30-12:00
- Weekends: Not allowed';