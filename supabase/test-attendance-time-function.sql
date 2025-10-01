-- Test queries to validate the attendance time function with dynamic time table
-- These can be run in Supabase SQL editor to test the function

-- NOTE: This function now queries the 'time' table dynamically
-- Make sure the time table has data before running these tests

-- Test 1: Monday check-in time (should return true if time table has data)
SELECT public.is_valid_attendance_time(
  '2024-01-08 07:30:00+07'::timestamptz, 
  'Hadir'
) AS "Monday 7:30 AM check-in (should be true)";

-- Test 2: Monday check-out time (should return true)
SELECT public.is_valid_attendance_time(
  '2024-01-08 15:30:00+07'::timestamptz, 
  'Pulang'
) AS "Monday 3:30 PM check-out (should be true)";

-- Test 3: Friday check-out time (should return true)
SELECT public.is_valid_attendance_time(
  '2024-01-12 11:45:00+07'::timestamptz, 
  'Pulang'
) AS "Friday 11:45 AM check-out (should be true)";

-- Test 4: Outside hours (should return false)
SELECT public.is_valid_attendance_time(
  '2024-01-08 10:00:00+07'::timestamptz, 
  'Hadir'
) AS "Monday 10:00 AM check-in (should be false - outside)";

-- Test 5: Weekend (should return false)
SELECT public.is_valid_attendance_time(
  '2024-01-13 08:00:00+07'::timestamptz, 
  'Hadir'
) AS "Saturday 8:00 AM check-in (should be false - weekend)";

-- Test 6: Tuesday check-out (should return true)
SELECT public.is_valid_attendance_time(
  '2024-01-09 15:30:00+07'::timestamptz, 
  'Pulang'
) AS "Tuesday 3:30 PM check-out (should be true)";

-- Test 7: Tuesday late check-out (depends on time table data)
SELECT public.is_valid_attendance_time(
  '2024-01-09 17:00:00+07'::timestamptz, 
  'Pulang'
) AS "Tuesday 5:00 PM check-out (may be false - too late)";

-- Test 8: Early morning check-in
SELECT public.is_valid_attendance_time(
  '2024-01-08 07:00:00+07'::timestamptz, 
  'Hadir'
) AS "Monday 7:00 AM check-in (should be true - start time)";

-- Test 9: Late check-in
SELECT public.is_valid_attendance_time(
  '2024-01-08 08:00:00+07'::timestamptz, 
  'Hadir'
) AS "Monday 8:00 AM check-in (should be false - too late)";

-- Display all results in one query
SELECT 
  public.is_valid_attendance_time('2024-01-08 07:30:00+07'::timestamptz, 'Hadir') AS "Mon_7_30_check_in",
  public.is_valid_attendance_time('2024-01-08 15:30:00+07'::timestamptz, 'Pulang') AS "Mon_15_30_check_out",
  public.is_valid_attendance_time('2024-01-12 11:45:00+07'::timestamptz, 'Pulang') AS "Fri_11_45_check_out",
  public.is_valid_attendance_time('2024-01-08 10:00:00+07'::timestamptz, 'Hadir') AS "Mon_10_00_outside",
  public.is_valid_attendance_time('2024-01-13 08:00:00+07'::timestamptz, 'Hadir') AS "Sat_8_00_weekend";

-- Query to check what's in the time table
SELECT 
  day_of_week,
  MIN(start_time) as earliest_start,
  MAX(end_time) as latest_end,
  COUNT(*) as num_periods
FROM public.time
GROUP BY day_of_week
ORDER BY 
  CASE day_of_week
    WHEN 'SENIN' THEN 1
    WHEN 'SELASA, RABU, KAMIS' THEN 2
    WHEN 'JUMAT' THEN 3
    ELSE 4
  END;