BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_nis_text TEXT;
  user_nis_bigint BIGINT;
  validated_role TEXT;
  profile_insert_count INTEGER;
BEGIN
  user_nis_text := NEW.raw_user_meta_data->>'nis';
  user_nis_bigint := user_nis_text::BIGINT;

  validated_role := NEW.raw_app_meta_data->>'role';
  IF validated_role NOT IN ('admin', 'kepala_sekolah', 'guru', 'wali_kelas', 'siswa') THEN
    validated_role := 'siswa';
  END IF;

  INSERT INTO user_profiles (user_id, full_name, email, nis, class_name, absence_number, gender, role)
  SELECT
    NEW.id,
    bs.nama,
    NEW.email,
    bs.nis::TEXT,
    bs.kelas,
    bs.absen::TEXT,
    bs.kelamin,
    validated_role
  FROM biodata_siswa AS bs
  WHERE bs.nis = user_nis_bigint;

  GET DIAGNOSTICS profile_insert_count = ROW_COUNT;

  IF profile_insert_count = 0 THEN
    RAISE EXCEPTION 'No biodata_siswa row found for nis % while creating user profile',
      user_nis_text;
  END IF;

  UPDATE biodata_siswa
  SET activated = true
  WHERE nis = user_nis_bigint;

  RETURN NEW;
END;
$$;

COMMIT;
