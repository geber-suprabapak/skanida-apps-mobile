-- Test queries to validate the attendance time function
-- These can be run in Supabase SQL editor to test the function

-- Test 1: Monday check-in time (should return true)
SELECT public.is_valid_attendance_time(
  '2024-01-08 07:30:00+07'::timestamptz, 
  'Hadir'
) AS "Monday 7:30 AM check-in";

-- Test 2: Monday check-out time (should return true)
SELECT public.is_valid_attendance_time(
  '2024-01-08 15:30:00+07'::timestamptz, 
  'Pulang'
) AS "Monday 3:30 PM check-out";

-- Test 3: Friday check-out time (should return true)
SELECT public.is_valid_attendance_time(
  '2024-01-12 12:00:00+07'::timestamptz, 
  'Pulang'
) AS "Friday 12:00 PM check-out";

-- Test 4: Outside hours (should return false)
SELECT public.is_valid_attendance_time(
  '2024-01-08 10:00:00+07'::timestamptz, 
  'Hadir'
) AS "Monday 10:00 AM check-in (outside)";

-- Test 5: Weekend (should return false)
SELECT public.is_valid_attendance_time(
  '2024-01-13 08:00:00+07'::timestamptz, 
  'Hadir'
) AS "Saturday 8:00 AM check-in";

-- Test 6: Tuesday check-out (should return true)
SELECT public.is_valid_attendance_time(
  '2024-01-09 14:30:00+07'::timestamptz, 
  'Pulang'
) AS "Tuesday 2:30 PM check-out";

-- Test 7: Tuesday late check-out (should return false)
SELECT public.is_valid_attendance_time(
  '2024-01-09 15:30:00+07'::timestamptz, 
  'Pulang'
) AS "Tuesday 3:30 PM check-out (late)";

-- Display all results in one query
SELECT 
  public.is_valid_attendance_time('2024-01-08 07:30:00+07'::timestamptz, 'Hadir') AS "Mon_7_30_check_in",
  public.is_valid_attendance_time('2024-01-08 15:30:00+07'::timestamptz, 'Pulang') AS "Mon_15_30_check_out",
  public.is_valid_attendance_time('2024-01-12 12:00:00+07'::timestamptz, 'Pulang') AS "Fri_12_00_check_out",
  public.is_valid_attendance_time('2024-01-08 10:00:00+07'::timestamptz, 'Hadir') AS "Mon_10_00_outside",
  public.is_valid_attendance_time('2024-01-13 08:00:00+07'::timestamptz, 'Hadir') AS "Sat_8_00_weekend";