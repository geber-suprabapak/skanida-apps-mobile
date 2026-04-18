-- ============================================================================
-- Compatibility Patch: Restore attendance RPC contracts used by mobile app
-- Date: 2026-03-05
--
-- Restores/maintains RPC signatures expected by app screens:
-- - get_and_validate_attendance_action(uuid, double precision, double precision)
-- - save_attendance_record(uuid, text, text, double precision, double precision, uuid)
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_and_validate_attendance_action(uuid, double precision, double precision);
DROP TYPE IF EXISTS public.attendance_action_response;

CREATE TYPE public.attendance_action_response AS (
  actionable BOOLEAN,
  action_type TEXT,
  message TEXT,
  details JSONB
);

CREATE OR REPLACE FUNCTION public.get_and_validate_attendance_action(
  p_user_id UUID,
  p_user_lat DOUBLE PRECISION,
  p_user_lon DOUBLE PRECISION
)
RETURNS public.attendance_action_response
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_wib DATE;
  v_current_time_wib TIME;
  v_current_day_indonesian TEXT;
  v_schedule RECORD;
  v_nearest_location RECORD;
  v_has_checked_in BOOLEAN := FALSE;
  v_has_checked_out BOOLEAN := FALSE;
  v_has_active_permit BOOLEAN := FALSE;
  v_response public.attendance_action_response;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  v_today_wib := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_current_time_wib := (now() AT TIME ZONE 'Asia/Jakarta')::time;
  v_current_day_indonesian := CASE trim(lower(to_char(now() AT TIME ZONE 'Asia/Jakarta', 'Day')))
    WHEN 'sunday' THEN 'minggu'
    WHEN 'monday' THEN 'senin'
    WHEN 'tuesday' THEN 'selasa'
    WHEN 'wednesday' THEN 'rabu'
    WHEN 'thursday' THEN 'kamis'
    WHEN 'friday' THEN 'jumat'
    WHEN 'saturday' THEN 'sabtu'
  END;

  SELECT EXISTS(
    SELECT 1
    FROM public.perizinan
    WHERE user_id = p_user_id
      AND approval_status IN ('pending', 'approved')
      AND (tanggal AT TIME ZONE 'Asia/Jakarta')::date = v_today_wib
  ) INTO v_has_active_permit;

  IF v_has_active_permit THEN
    SELECT FALSE, 'none', 'Anda sudah mengajukan izin untuk hari ini. Tidak dapat melakukan absensi jika sudah ada izin aktif (pending/approved).', null::jsonb INTO v_response;
    RETURN v_response;
  END IF;

  SELECT
    id,
    name,
    distance AS max_distance,
    (point(p_user_lon, p_user_lat) <@> point(longitude, latitude)) * 1609.34 AS distance_m
  INTO v_nearest_location
  FROM public.location
  WHERE is_active = TRUE
  ORDER BY distance_m ASC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT FALSE, 'none', 'Tidak ada lokasi absensi yang aktif.', null::jsonb INTO v_response;
    RETURN v_response;
  END IF;

  IF v_nearest_location.distance_m > v_nearest_location.max_distance THEN
    SELECT FALSE, 'none', 'Anda berada di luar jangkauan area absensi.', jsonb_build_object('location_name', v_nearest_location.name) INTO v_response;
    RETURN v_response;
  END IF;

  SELECT *
  INTO v_schedule
  FROM public.jadwal_absensi
  WHERE hari = v_current_day_indonesian
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT FALSE, 'none', 'Tidak ada jadwal absensi yang aktif untuk hari ini.', null::jsonb INTO v_response;
    RETURN v_response;
  END IF;

  SELECT
    EXISTS(
      SELECT 1
      FROM public.absences
      WHERE user_id = p_user_id
        AND date = v_today_wib
        AND status IN ('Hadir', 'Terlambat')
    ),
    EXISTS(
      SELECT 1
      FROM public.absences
      WHERE user_id = p_user_id
        AND date = v_today_wib
        AND status = 'Pulang'
    )
  INTO v_has_checked_in, v_has_checked_out;

  IF v_has_checked_out THEN
    SELECT FALSE, 'none', 'Anda sudah menyelesaikan absensi hari ini.', jsonb_build_object('location_name', v_nearest_location.name) INTO v_response;
  ELSIF v_has_checked_in THEN
    IF v_current_time_wib BETWEEN v_schedule.mulai_pulang::time AND v_schedule.selesai_pulang::time THEN
      SELECT TRUE, 'check_out', 'Silakan lakukan presensi pulang.', jsonb_build_object('location_name', v_nearest_location.name) INTO v_response;
    ELSE
      SELECT FALSE, 'none', 'Belum memasuki waktu presensi pulang.', jsonb_build_object('location_name', v_nearest_location.name) INTO v_response;
    END IF;
  ELSE
    IF v_current_time_wib BETWEEN v_schedule.mulai_masuk::time AND (v_schedule.selesai_masuk::time + (v_schedule.kompensasi_waktu || ' minutes')::interval) THEN
      IF v_current_time_wib > v_schedule.selesai_masuk::time THEN
        SELECT TRUE, 'check_in', 'Anda terlambat. Silakan lanjutkan absensi.', jsonb_build_object('location_name', v_nearest_location.name, 'status', 'Terlambat') INTO v_response;
      ELSE
        SELECT TRUE, 'check_in', 'Tepat waktu! Silakan presensi masuk.', jsonb_build_object('location_name', v_nearest_location.name, 'status', 'Hadir') INTO v_response;
      END IF;
    ELSE
      SELECT FALSE, 'none', 'Waktu untuk absen masuk sudah berakhir atau belum dimulai.', jsonb_build_object('location_name', v_nearest_location.name) INTO v_response;
    END IF;
  END IF;

  RETURN v_response;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_and_validate_attendance_action(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

DROP FUNCTION IF EXISTS public.save_attendance_record(UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, UUID);

CREATE OR REPLACE FUNCTION public.save_attendance_record(
  p_user_id UUID,
  p_action_type TEXT,
  p_photo_path TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_attendance_id_to_update UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_wib DATE;
  v_current_time_wib TIME;
  v_schedule RECORD;
  v_status_text TEXT;
  v_new_attendance_id UUID;
  v_result JSONB;
  v_current_day_indonesian TEXT;
  v_validated_action public.attendance_action_response;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  v_today_wib := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_current_time_wib := (now() AT TIME ZONE 'Asia/Jakarta')::time;

  v_current_day_indonesian := CASE trim(lower(to_char(now() AT TIME ZONE 'Asia/Jakarta', 'Day')))
    WHEN 'sunday' THEN 'minggu'
    WHEN 'monday' THEN 'senin'
    WHEN 'tuesday' THEN 'selasa'
    WHEN 'wednesday' THEN 'rabu'
    WHEN 'thursday' THEN 'kamis'
    WHEN 'friday' THEN 'jumat'
    WHEN 'saturday' THEN 'sabtu'
  END;

  SELECT * INTO v_schedule
  FROM public.jadwal_absensi
  WHERE hari = v_current_day_indonesian
    AND is_active = TRUE
  LIMIT 1;

  SELECT * INTO v_validated_action
  FROM public.get_and_validate_attendance_action(p_user_id, p_latitude, p_longitude);

  IF NOT COALESCE(v_validated_action.actionable, FALSE)
    OR v_validated_action.action_type IS DISTINCT FROM p_action_type THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', COALESCE(v_validated_action.message, 'Aksi absensi tidak valid.')
    );
  END IF;

  IF p_action_type = 'check_in' THEN
    v_status_text := COALESCE(v_validated_action.details ->> 'status', 'Hadir');

    IF v_status_text NOT IN ('Hadir', 'Terlambat') THEN
      v_status_text := 'Hadir';
    END IF;

    INSERT INTO public.absences (user_id, date, status, photo_url, latitude, longitude)
    VALUES (p_user_id, v_today_wib, v_status_text, p_photo_path, p_latitude, p_longitude)
    RETURNING id INTO v_new_attendance_id;

    v_result := jsonb_build_object('success', true, 'message', 'Presensi masuk berhasil direkam.', 'attendance_id', v_new_attendance_id);
  ELSIF p_action_type = 'check_out' THEN
    v_status_text := 'Pulang';

    INSERT INTO public.absences (user_id, date, status, photo_url, latitude, longitude)
    VALUES (p_user_id, v_today_wib, v_status_text, p_photo_path, p_latitude, p_longitude)
    RETURNING id INTO v_new_attendance_id;

    v_result := jsonb_build_object('success', true, 'message', 'Presensi pulang berhasil direkam.', 'attendance_id', v_new_attendance_id);
  ELSE
    v_result := jsonb_build_object('success', false, 'message', 'Aksi tidak valid.');
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_attendance_record(UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, UUID) TO authenticated;

COMMIT;
