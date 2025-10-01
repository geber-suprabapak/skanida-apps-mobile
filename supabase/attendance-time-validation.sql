-- Attendance time validation functions and policies for Supabase
-- This file should be executed in the Supabase SQL editor

-- Function to check if a given timestamp is within allowed attendance hours
-- Returns boolean based on school schedule from time table
CREATE OR REPLACE FUNCTION public.is_valid_attendance_time(
  check_time timestamptz,
  attendance_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_name text;
  time_of_day time;
  check_in_record record;
  check_out_record record;
  day_of_week integer;
BEGIN
  -- Extract day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  -- Convert to local timezone (Asia/Jakarta) before checking
  day_of_week := EXTRACT(DOW FROM check_time AT TIME ZONE 'Asia/Jakarta');
  
  -- Extract time of day
  time_of_day := (check_time AT TIME ZONE 'Asia/Jakarta')::time;
  
  -- Skip weekends (Saturday = 6, Sunday = 0)
  IF day_of_week = 0 OR day_of_week = 6 THEN
    RETURN false;
  END IF;
  
  -- Map day of week number to day name
  IF day_of_week = 1 THEN
    day_name := 'SENIN';
  ELSIF day_of_week >= 2 AND day_of_week <= 4 THEN
    day_name := 'SELASA, RABU, KAMIS';
  ELSIF day_of_week = 5 THEN
    day_name := 'JUMAT';
  ELSE
    RETURN false;
  END IF;
  
  -- Check if time is valid based on attendance status
  IF attendance_status IN ('Hadir', 'Datang') THEN
    -- Check-in validation: find the earliest start time for the day
    SELECT start_time, end_time INTO check_in_record
    FROM public.time
    WHERE day_of_week = day_name
    ORDER BY start_time ASC
    LIMIT 1;
    
    IF check_in_record IS NULL THEN
      -- No schedule found, fall back to default validation
      RETURN time_of_day >= '07:00:00' AND time_of_day <= '07:45:00';
    END IF;
    
    -- Allow check-in from start_time until 45 minutes after
    RETURN time_of_day >= check_in_record.start_time 
       AND time_of_day <= (check_in_record.start_time + INTERVAL '45 minutes');
       
  ELSIF attendance_status = 'Pulang' THEN
    -- Check-out validation: find the latest end time for the day
    SELECT start_time, end_time INTO check_out_record
    FROM public.time
    WHERE day_of_week = day_name
    ORDER BY end_time DESC
    LIMIT 1;
    
    IF check_out_record IS NULL THEN
      -- No schedule found, fall back to default validation
      IF day_name = 'SENIN' THEN
        RETURN time_of_day >= '15:00:00' AND time_of_day <= '16:00:00';
      ELSIF day_name = 'SELASA, RABU, KAMIS' THEN
        RETURN time_of_day >= '15:15:00' AND time_of_day <= '16:00:00';
      ELSIF day_name = 'JUMAT' THEN
        RETURN time_of_day >= '11:30:00' AND time_of_day <= '12:00:00';
      END IF;
    END IF;
    
    -- Allow check-out from 30 minutes before end_time until 45 minutes after
    RETURN time_of_day >= (check_out_record.end_time - INTERVAL '30 minutes')
       AND time_of_day <= (check_out_record.end_time + INTERVAL '45 minutes');
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
'Validates if attendance can be recorded at the given time based on school schedule from time table.
Queries the time table dynamically and falls back to hardcoded schedule if table is empty:
- Monday (SENIN): Check-in from earliest start_time (+45min), Check-out from latest end_time (-30min to +45min)
- Tuesday-Thursday (SELASA, RABU, KAMIS): Same pattern
- Friday (JUMAT): Same pattern
- Weekends: Not allowed';