-- Project Chronos - Latest Database Schema
-- Generated: 2025-10-06
-- Database: PostgreSQL with Supabase Auth
-- Integrated with RLS, Storage Policies, and Auto Profile Creation

-- ============================================================================
-- Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS plpgsql;
CREATE EXTENSION IF NOT EXISTS cube; -- Required by earthdistance
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE; -- Automatically installs cube if not present

-- ============================================================================
-- Table: biodata_siswa
-- Description: Student master data for registration
-- ============================================================================
CREATE TABLE IF NOT EXISTS biodata_siswa (
    nis BIGINT PRIMARY KEY NOT NULL,
    nama TEXT,
    kelas TEXT,
    absen INTEGER,
    kelamin TEXT,
    activated BOOLEAN DEFAULT FALSE NOT NULL
);

-- ============================================================================
-- Table: user_profiles
-- Description: Extended user profile data linked to Supabase auth.users
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL UNIQUE,
    nis TEXT,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    absence_number TEXT,
    class_name TEXT,
    gender TEXT,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_user_profiles_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create unique index for user_id
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_unique ON user_profiles(user_id);

-- ============================================================================
-- Table: absences
-- Description: Student attendance records
-- ============================================================================
CREATE TABLE IF NOT EXISTS absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    reason TEXT,
    photo_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_absences_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT absences_status_check CHECK (status = ANY (ARRAY['Hadir'::TEXT, 'Datang'::TEXT, 'Pulang'::TEXT]))
);

-- ============================================================================
-- Table: perizinan
-- Description: Permission/leave requests from students
-- ============================================================================
CREATE TABLE IF NOT EXISTS perizinan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    tanggal TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    kategori_izin TEXT NOT NULL,
    deskripsi TEXT,
    link_foto TEXT,
    approval_status TEXT DEFAULT 'pending' NOT NULL,
    status BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    rejected_at TIMESTAMPTZ,
    rejected_by TEXT,
    tanggal_utc_date DATE,
    CONSTRAINT fk_perizinan_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_perizinan_approved_by FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT perizinan_kategori_izin_check CHECK (kategori_izin = ANY (ARRAY['sakit'::TEXT, 'pergi'::TEXT])),
    CONSTRAINT perizinan_approval_status_check CHECK (approval_status = ANY (ARRAY['pending'::TEXT, 'approved'::TEXT, 'rejected'::TEXT]))
);

-- ============================================================================
-- Table: location
-- Description: System configuration for location-based attendance
-- ============================================================================
CREATE TABLE IF NOT EXISTS location (
    id INTEGER PRIMARY KEY NOT NULL,
    name VARCHAR(255) NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    distance INTEGER NOT NULL, -- distance in meters
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- Table: jadwal_absensi
-- Description: Schedule configuration for attendance system
-- ============================================================================
CREATE TABLE IF NOT EXISTS jadwal_absensi (
    id INTEGER PRIMARY KEY NOT NULL,
    hari VARCHAR(20) NOT NULL, -- senin, selasa, rabu, kamis, jumat, sabtu, minggu
    mulai_masuk VARCHAR(8) NOT NULL, -- HH:MM:SS format
    selesai_masuk VARCHAR(8) NOT NULL, -- HH:MM:SS format
    mulai_pulang VARCHAR(8) NOT NULL, -- HH:MM:SS format
    selesai_pulang VARCHAR(8) NOT NULL, -- HH:MM:SS format
    kompensasi_waktu INTEGER DEFAULT 0 NOT NULL, -- in minutes
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Insert default schedule data
INSERT INTO jadwal_absensi (id, hari, mulai_masuk, selesai_masuk, mulai_pulang, selesai_pulang, kompensasi_waktu, is_active)
VALUES
    (1, 'senin', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, TRUE),
    (2, 'selasa', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 20, TRUE),
    (3, 'rabu', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, TRUE),
    (4, 'kamis', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, TRUE),
    (5, 'jumat', '06:30:00', '07:30:00', '15:00:00', '12:00:00', 15, TRUE),
    (6, 'sabtu', '06:30:00', '07:30:00', '12:00:00', '13:00:00', 15, FALSE),
    (7, 'minggu', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Indexes for absences table
CREATE INDEX IF NOT EXISTS idx_absences_user_id ON absences(user_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(date);
CREATE INDEX IF NOT EXISTS idx_absences_status ON absences(status);

-- Indexes for perizinan table
CREATE INDEX IF NOT EXISTS idx_perizinan_user_id ON perizinan(user_id);
CREATE INDEX IF NOT EXISTS idx_perizinan_tanggal ON perizinan(tanggal);
CREATE INDEX IF NOT EXISTS idx_perizinan_approval_status ON perizinan(approval_status);
CREATE INDEX IF NOT EXISTS idx_perizinan_tanggal_utc_date ON perizinan(tanggal_utc_date);

-- Indexes for user_profiles table
CREATE INDEX IF NOT EXISTS idx_user_profiles_nis ON user_profiles(nis);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ============================================================================
-- Triggers for auto-updating updated_at timestamp
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for perizinan
DROP TRIGGER IF EXISTS update_perizinan_updated_at ON perizinan;
CREATE TRIGGER update_perizinan_updated_at
    BEFORE UPDATE ON perizinan
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for location
DROP TRIGGER IF EXISTS update_location_updated_at ON location;
CREATE TRIGGER update_location_updated_at
    BEFORE UPDATE ON location
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for jadwal_absensi
DROP TRIGGER IF EXISTS update_jadwal_absensi_updated_at ON jadwal_absensi;
CREATE TRIGGER update_jadwal_absensi_updated_at
    BEFORE UPDATE ON jadwal_absensi
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Trigger for perizinan.tanggal_utc_date (auto-populate from tanggal)
-- ============================================================================

-- Function to auto-populate tanggal_utc_date from tanggal
CREATE OR REPLACE FUNCTION set_perizinan_tanggal_utc_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tanggal_utc_date = (NEW.tanggal AT TIME ZONE 'UTC')::DATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for perizinan tanggal_utc_date
DROP TRIGGER IF EXISTS set_perizinan_tanggal_utc_date_trigger ON perizinan;
CREATE TRIGGER set_perizinan_tanggal_utc_date_trigger
    BEFORE INSERT OR UPDATE OF tanggal ON perizinan
    FOR EACH ROW
    EXECUTE FUNCTION set_perizinan_tanggal_utc_date();

-- Backfill existing records (safe to run multiple times)
UPDATE perizinan SET tanggal_utc_date = (tanggal AT TIME ZONE 'UTC')::DATE WHERE tanggal_utc_date IS NULL;

-- Create unique constraint to enforce one perizinan per user per day
CREATE UNIQUE INDEX IF NOT EXISTS perizinan_user_day_unique ON perizinan(user_id, tanggal_utc_date);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE biodata_siswa IS 'Student master data for registration and activation';
COMMENT ON TABLE user_profiles IS 'Extended user profile data linked to Supabase auth.users';
COMMENT ON TABLE absences IS 'Student attendance records with location data';
COMMENT ON TABLE perizinan IS 'Permission/leave requests with approval workflow';
COMMENT ON TABLE location IS 'System configuration for location-based attendance validation';
COMMENT ON TABLE jadwal_absensi IS 'Schedule configuration for attendance time windows';

COMMENT ON COLUMN absences.status IS 'Attendance status: Hadir (present), Datang (check-in), Pulang (check-out)';
COMMENT ON COLUMN perizinan.kategori_izin IS 'Permission category: sakit (sick), pergi (other leave)';
COMMENT ON COLUMN perizinan.approval_status IS 'Approval workflow status: pending, approved, rejected';
COMMENT ON COLUMN perizinan.tanggal_utc_date IS 'Helper column auto-populated from tanggal for date-based queries';
COMMENT ON COLUMN location.distance IS 'Maximum allowed distance from location in meters';
COMMENT ON COLUMN jadwal_absensi.kompensasi_waktu IS 'Time compensation/buffer in minutes';

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all user-facing tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE perizinan ENABLE ROW LEVEL SECURITY;
ALTER TABLE biodata_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE location ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_absensi ENABLE ROW LEVEL SECURITY;

-- user_profiles policies: users can only access their own profile
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_select_own'
  ) THEN
    CREATE POLICY user_profiles_select_own ON user_profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_insert_own'
  ) THEN
    CREATE POLICY user_profiles_insert_own ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_update_own'
  ) THEN
    CREATE POLICY user_profiles_update_own ON user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- absences policies: users can only access their own absences
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='absences' AND policyname='absences_select_own'
  ) THEN
    CREATE POLICY absences_select_own ON absences FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='absences' AND policyname='absences_insert_own'
  ) THEN
    CREATE POLICY absences_insert_own ON absences FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='absences' AND policyname='absences_update_own'
  ) THEN
    CREATE POLICY absences_update_own ON absences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- perizinan policies: users can only access their own perizinan
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='perizinan' AND policyname='perizinan_select_own'
  ) THEN
    CREATE POLICY perizinan_select_own ON perizinan FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='perizinan' AND policyname='perizinan_insert_own'
  ) THEN
    CREATE POLICY perizinan_insert_own ON perizinan FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='perizinan' AND policyname='perizinan_update_own'
  ) THEN
    CREATE POLICY perizinan_update_own ON perizinan FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- location policies: Teachers/Admins can view all, everyone can view active, admins can manage
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='location' AND policyname='Teachers can view all locations'
  ) THEN
    CREATE POLICY "Teachers can view all locations" ON location 
      FOR SELECT 
      USING (
        EXISTS (
          SELECT 1
          FROM user_profiles
          WHERE (user_profiles.user_id = auth.uid()) 
            AND (user_profiles.role = ANY (ARRAY['admin'::TEXT, 'guru'::TEXT]))
        )
      );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='location' AND policyname='Everyone can view active locations'
  ) THEN
    CREATE POLICY "Everyone can view active locations" ON location 
      FOR SELECT 
      USING (is_active = true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='location' AND policyname='Admins can manage locations'
  ) THEN
    CREATE POLICY "Admins can manage locations" ON location 
      FOR ALL 
      USING (
        EXISTS (
          SELECT 1
          FROM user_profiles
          WHERE (user_profiles.user_id = auth.uid()) 
            AND (user_profiles.role = 'admin'::TEXT)
        )
      );
  END IF;
END $$;

-- jadwal_absensi policies: Everyone can view, only admins can manage
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jadwal_absensi' AND policyname='Everyone can view schedule'
  ) THEN
    CREATE POLICY "Everyone can view schedule" ON jadwal_absensi 
      FOR SELECT 
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jadwal_absensi' AND policyname='Admins can manage schedule'
  ) THEN
    CREATE POLICY "Admins can manage schedule" ON jadwal_absensi 
      FOR ALL 
      USING (
        EXISTS (
          SELECT 1
          FROM user_profiles
          WHERE (user_profiles.user_id = auth.uid()) 
            AND (user_profiles.role = 'admin'::TEXT)
        )
      );
  END IF;
END $$;

-- ============================================================================
-- Storage Buckets & Policies
-- ============================================================================

-- Create storage buckets (private by default)
DO $$
DECLARE
  has_create_bucket BOOLEAN;
BEGIN
  -- Detect helper function storage.create_bucket
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'storage' AND p.proname = 'create_bucket'
  ) INTO has_create_bucket;

  -- attendance-photos bucket
  BEGIN
    IF has_create_bucket THEN
      PERFORM storage.create_bucket('attendance-photos', false);
    ELSE
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('attendance-photos', 'attendance-photos', false)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Insufficient privilege to create bucket attendance-photos. Create it via Supabase Studio (private).';
    WHEN OTHERS THEN
      RAISE NOTICE 'Skipping attendance-photos bucket creation: %', SQLERRM;
  END;

  -- perizinan bucket
  BEGIN
    IF has_create_bucket THEN
      PERFORM storage.create_bucket('perizinan', false);
    ELSE
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('perizinan', 'perizinan', false)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Insufficient privilege to create bucket perizinan. Create it via Supabase Studio (private).';
    WHEN OTHERS THEN
      RAISE NOTICE 'Skipping perizinan bucket creation: %', SQLERRM;
  END;

  -- avatars bucket
  BEGIN
    IF has_create_bucket THEN
      PERFORM storage.create_bucket('avatars', false);
    ELSE
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('avatars', 'avatars', false)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Insufficient privilege to create bucket avatars. Create it via Supabase Studio (private).';
    WHEN OTHERS THEN
      RAISE NOTICE 'Skipping avatars bucket creation: %', SQLERRM;
  END;

  -- Ensure buckets are private
  BEGIN
    UPDATE storage.buckets
      SET public = false
      WHERE id IN ('attendance-photos', 'perizinan', 'avatars')
        AND public IS DISTINCT FROM false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Cannot set buckets to private; set privacy in Supabase Studio UI.';
    WHEN OTHERS THEN
      RAISE NOTICE 'Update bucket privacy skipped: %', SQLERRM;
  END;

  -- Enable RLS on storage.objects
  BEGIN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Cannot enable RLS on storage.objects; likely already enabled or requires owner.';
    WHEN OTHERS THEN
      RAISE NOTICE 'Enable RLS skipped: %', SQLERRM;
  END;

  -- Storage policies: Owner read policies
  BEGIN
    EXECUTE $pol$CREATE POLICY owner_read_attendance_photos ON storage.objects FOR SELECT USING (bucket_id = 'attendance-photos' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_read_attendance_photos denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_read_attendance_photos skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_read_perizinan ON storage.objects FOR SELECT USING (bucket_id = 'perizinan' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_read_perizinan denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_read_perizinan skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_read_avatars ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_read_avatars denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_read_avatars skipped: %', SQLERRM;
  END;

  -- Storage policies: Authenticated upload policies
  BEGIN
    EXECUTE $pol$CREATE POLICY auth_upload_attendance_photos ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attendance-photos' AND auth.role() = 'authenticated')$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy auth_upload_attendance_photos denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy auth_upload_attendance_photos skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY auth_upload_perizinan ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'perizinan' AND auth.role() = 'authenticated')$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy auth_upload_perizinan denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy auth_upload_perizinan skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY auth_upload_avatars ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated')$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy auth_upload_avatars denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy auth_upload_avatars skipped: %', SQLERRM;
  END;

  -- Storage policies: Owner update/delete policies (attendance-photos)
  BEGIN
    EXECUTE $pol$CREATE POLICY owner_update_delete_attendance_photos ON storage.objects FOR UPDATE USING (bucket_id = 'attendance-photos' AND owner = auth.uid()) WITH CHECK (bucket_id = 'attendance-photos' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_update_delete_attendance_photos denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_update_delete_attendance_photos skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_delete_attendance_photos ON storage.objects FOR DELETE USING (bucket_id = 'attendance-photos' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_delete_attendance_photos denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_delete_attendance_photos skipped: %', SQLERRM;
  END;

  -- Storage policies: Owner update/delete policies (perizinan)
  BEGIN
    EXECUTE $pol$CREATE POLICY owner_update_delete_perizinan ON storage.objects FOR UPDATE USING (bucket_id = 'perizinan' AND owner = auth.uid()) WITH CHECK (bucket_id = 'perizinan' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_update_delete_perizinan denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_update_delete_perizinan skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_delete_perizinan ON storage.objects FOR DELETE USING (bucket_id = 'perizinan' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_delete_perizinan denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_delete_perizinan skipped: %', SQLERRM;
  END;

  -- Storage policies: Owner update/delete policies (avatars)
  BEGIN
    EXECUTE $pol$CREATE POLICY owner_update_delete_avatars ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND owner = auth.uid()) WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_update_delete_avatars denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_update_delete_avatars skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $pol$CREATE POLICY owner_delete_avatars ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND owner = auth.uid())$pol$;
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'Create policy owner_delete_avatars denied; add via Studio.';
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Policy owner_delete_avatars skipped: %', SQLERRM;
  END;

END $$;

-- ============================================================================
-- Grants and Permissions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE absences TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE perizinan TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE location TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE jadwal_absensi TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO anon, authenticated;

-- Default privileges for future tables
DO $$
BEGIN
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END$$;

-- ============================================================================
-- Automatic User Profile Creation
-- ============================================================================

-- Function to be called by trigger when a new user signs up
-- Creates user_profile and links to biodata_siswa
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_nis_text TEXT;
  user_nis_bigint BIGINT;
BEGIN
  -- Extract NIS from user metadata
  user_nis_text := NEW.raw_user_meta_data->>'nis';
  user_nis_bigint := user_nis_text::BIGINT;

  -- Create user profile by joining with biodata_siswa
  INSERT INTO user_profiles (user_id, full_name, email, nis, class_name, absence_number, gender, role)
  SELECT
    NEW.id,
    bs.nama,
    NEW.email,
    bs.nis::TEXT,
    bs.kelas,
    bs.absen::TEXT,
    bs.kelamin,
    'siswa' -- Default role
  FROM biodata_siswa AS bs
  WHERE bs.nis = user_nis_bigint;

  -- Mark biodata as activated
  UPDATE biodata_siswa
  SET activated = true
  WHERE nis = user_nis_bigint;

  RETURN NEW;
END;
$$;

-- Trigger to automatically create profile on user signup
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END$$;

-- ============================================================================
-- RPC Functions
-- ============================================================================

-- Function to securely get student biodata for activation check
CREATE OR REPLACE FUNCTION get_biodata_siswa(p_nis TEXT)
RETURNS TABLE (nama TEXT, nis TEXT, kelas TEXT, activated BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bs.nama,
    bs.nis::TEXT,
    bs.kelas,
    bs.activated
  FROM biodata_siswa AS bs
  WHERE bs.nis = p_nis::BIGINT;
END;
$$;

-- Grant execute permission to anon role (for pre-login activation check)
GRANT EXECUTE ON FUNCTION get_biodata_siswa(TEXT) TO anon;

-- Function to check nearest location and validate user distance
CREATE OR REPLACE FUNCTION check_nearest_location(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'location_id', l.id,
    'location_name', l.name,
    'distance_m', (
      6371000 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(user_lat)) 
          * cos(radians(l.latitude)) 
          * cos(radians(l.longitude) - radians(user_lon)) 
          + sin(radians(user_lat)) 
          * sin(radians(l.latitude))
        ))
      )
    ),
    'is_within_range', (
      6371000 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(user_lat)) 
          * cos(radians(l.latitude)) 
          * cos(radians(l.longitude) - radians(user_lon)) 
          + sin(radians(user_lat)) 
          * sin(radians(l.latitude))
        ))
      )
    ) <= l.distance
  ) INTO result
  FROM location AS l
  WHERE l.is_active = TRUE
  ORDER BY (
    6371000 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(user_lat)) 
        * cos(radians(l.latitude)) 
        * cos(radians(l.longitude) - radians(user_lon)) 
        + sin(radians(user_lat)) 
        * sin(radians(l.latitude))
      ))
    )
  ) ASC
  LIMIT 1;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_nearest_location(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ============================================================================
-- RPC Function: check_absensi_status
-- Description: Comprehensive validation for attendance check-in/out
-- ============================================================================

-- Step 1: Create custom type for function output
DROP TYPE IF EXISTS public.absensi_check_result CASCADE;
CREATE TYPE public.absensi_check_result AS (
    status_code TEXT,       -- VALID, OUT_OF_RANGE, NOT_SCHEDULED, TIME_OUT, ALREADY_COMPLETED
    required_action TEXT,   -- present (Masuk), home (Pulang), none
    location_name TEXT,     -- Name of nearest location
    distance_m DOUBLE PRECISION,  -- Distance to nearest location in meters
    message TEXT            -- User-friendly message
);

-- Step 2: Create the main RPC function
CREATE OR REPLACE FUNCTION check_absensi_status(
    p_user_id UUID,
    p_user_lat DOUBLE PRECISION,
    p_user_lon DOUBLE PRECISION
)
RETURNS public.absensi_check_result
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_result public.absensi_check_result;
    v_current_time TIME;
    v_current_date DATE;
    v_current_day TEXT;
    v_jadwal RECORD;
    v_nearest_location RECORD;
    v_distance_m DOUBLE PRECISION;
    v_last_absence RECORD;
    v_mulai_masuk TIME;
    v_selesai_masuk TIME;
    v_selesai_masuk_with_kompensasi TIME;
    v_mulai_pulang TIME;
    v_selesai_pulang TIME;
BEGIN
    -- Get current time and date in Asia/Jakarta timezone (WIB)
    v_current_time := (NOW() AT TIME ZONE 'Asia/Jakarta')::TIME;
    v_current_date := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
    
    -- Get current day name in Indonesian (lowercase)
    v_current_day := CASE EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Jakarta'))
        WHEN 0 THEN 'minggu'
        WHEN 1 THEN 'senin'
        WHEN 2 THEN 'selasa'
        WHEN 3 THEN 'rabu'
        WHEN 4 THEN 'kamis'
        WHEN 5 THEN 'jumat'
        WHEN 6 THEN 'sabtu'
    END;
    
    -- Step 1: Check if today's schedule exists and is active
    SELECT * INTO v_jadwal
    FROM jadwal_absensi
    WHERE LOWER(hari) = v_current_day
      AND is_active = TRUE
    LIMIT 1;
    
    IF NOT FOUND THEN
        v_result.status_code := 'NOT_SCHEDULED';
        v_result.required_action := 'none';
        v_result.location_name := NULL;
        v_result.distance_m := NULL;
        v_result.message := 'Tidak ada jadwal absensi untuk hari ini';
        RETURN v_result;
    END IF;
    
    -- Parse time fields from jadwal
    v_mulai_masuk := v_jadwal.mulai_masuk::TIME;
    v_selesai_masuk := v_jadwal.selesai_masuk::TIME;
    v_selesai_masuk_with_kompensasi := (v_jadwal.selesai_masuk::TIME + (v_jadwal.kompensasi_waktu || ' minutes')::INTERVAL);
    v_mulai_pulang := v_jadwal.mulai_pulang::TIME;
    v_selesai_pulang := v_jadwal.selesai_pulang::TIME;
    
    -- Step 2: Find nearest active location and calculate distance
    SELECT
        l.id,
        l.name,
        l.distance AS max_distance,
        (
            6371000 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians(p_user_lat)) 
                    * cos(radians(l.latitude)) 
                    * cos(radians(l.longitude) - radians(p_user_lon)) 
                    + sin(radians(p_user_lat)) 
                    * sin(radians(l.latitude))
                ))
            )
        ) AS calculated_distance
    INTO v_nearest_location
    FROM location AS l
    WHERE l.is_active = TRUE
    ORDER BY calculated_distance ASC
    LIMIT 1;
    
    IF NOT FOUND THEN
        v_result.status_code := 'OUT_OF_RANGE';
        v_result.required_action := 'none';
        v_result.location_name := NULL;
        v_result.distance_m := NULL;
        v_result.message := 'Tidak ada lokasi aktif yang tersedia';
        RETURN v_result;
    END IF;
    
    v_distance_m := v_nearest_location.calculated_distance;
    
    -- Step 3: Check if user is within allowed radius
    IF v_distance_m > v_nearest_location.max_distance THEN
        v_result.status_code := 'OUT_OF_RANGE';
        v_result.required_action := 'none';
        v_result.location_name := v_nearest_location.name;
        v_result.distance_m := v_distance_m;
        v_result.message := 'Anda berada ' || ROUND(v_distance_m)::TEXT || ' meter dari ' || v_nearest_location.name || '. Jarak maksimal: ' || v_nearest_location.max_distance::TEXT || ' meter';
        RETURN v_result;
    END IF;
    
    -- Step 4: Check last absence record for today
    SELECT * INTO v_last_absence
    FROM absences
    WHERE user_id = p_user_id
      AND date = v_current_date
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Step 5: Determine required action based on last absence
    IF NOT FOUND OR v_last_absence.status NOT IN ('Hadir', 'Datang', 'Pulang') THEN
        -- No absence yet today -> Need to check in (present/Datang)
        -- Validate time window for check-in
        IF v_current_time >= v_mulai_masuk AND v_current_time <= v_selesai_masuk_with_kompensasi THEN
            v_result.status_code := 'VALID';
            v_result.required_action := 'present';
            v_result.location_name := v_nearest_location.name;
            v_result.distance_m := v_distance_m;
            v_result.message := 'Silakan absen masuk di ' || v_nearest_location.name || ' (' || ROUND(v_distance_m)::TEXT || ' meter)';
        ELSE
            v_result.status_code := 'TIME_OUT';
            v_result.required_action := 'present';
            v_result.location_name := v_nearest_location.name;
            v_result.distance_m := v_distance_m;
            v_result.message := 'Waktu absen masuk: ' || v_mulai_masuk::TEXT || ' - ' || v_selesai_masuk::TEXT || ' (kompensasi: +' || v_jadwal.kompensasi_waktu::TEXT || ' menit). Sekarang: ' || v_current_time::TEXT;
        END IF;
        
    ELSIF v_last_absence.status IN ('Hadir', 'Datang') THEN
        -- Already checked in -> Need to check out (home/Pulang)
        -- Validate time window for check-out
        IF v_current_time >= v_mulai_pulang AND v_current_time <= v_selesai_pulang THEN
            v_result.status_code := 'VALID';
            v_result.required_action := 'home';
            v_result.location_name := v_nearest_location.name;
            v_result.distance_m := v_distance_m;
            v_result.message := 'Silakan absen pulang di ' || v_nearest_location.name || ' (' || ROUND(v_distance_m)::TEXT || ' meter)';
        ELSE
            v_result.status_code := 'TIME_OUT';
            v_result.required_action := 'home';
            v_result.location_name := v_nearest_location.name;
            v_result.distance_m := v_distance_m;
            v_result.message := 'Waktu absen pulang: ' || v_mulai_pulang::TEXT || ' - ' || v_selesai_pulang::TEXT || '. Sekarang: ' || v_current_time::TEXT;
        END IF;
        
    ELSIF v_last_absence.status = 'Pulang' THEN
        -- Already completed both check-in and check-out
        v_result.status_code := 'ALREADY_COMPLETED';
        v_result.required_action := 'none';
        v_result.location_name := v_nearest_location.name;
        v_result.distance_m := v_distance_m;
        v_result.message := 'Absensi hari ini sudah lengkap (masuk dan pulang)';
    END IF;
    
    RETURN v_result;
END;
$$;

-- Step 3: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_absensi_status(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION check_absensi_status IS 'Validates attendance check-in/out based on schedule, location proximity, and previous attendance records. Uses Asia/Jakarta timezone.';

-- ============================================================================
-- End of Schema
-- ============================================================================
