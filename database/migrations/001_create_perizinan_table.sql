-- 1) Create table
CREATE TABLE IF NOT EXISTS public.perizinan (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kategori_izin     TEXT NOT NULL CHECK (kategori_izin IN ('sakit','pergi')),
  deskripsi         TEXT NOT NULL,
  status            BOOLEAN NOT NULL DEFAULT FALSE,
  link_foto         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by       UUID REFERENCES auth.users(id),
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_perizinan_user_id   ON public.perizinan(user_id);
CREATE INDEX IF NOT EXISTS idx_perizinan_status    ON public.perizinan(status);

-- 3) Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_perizinan_update ON public.perizinan;
CREATE TRIGGER trg_perizinan_update
  BEFORE UPDATE ON public.perizinan
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- 4) Enable RLS
ALTER TABLE public.perizinan ENABLE ROW LEVEL SECURITY;

-- 5) Policies for authenticated users
-- allow users to SELECT only their own rows
CREATE POLICY sel_own_perizinan ON public.perizinan
  FOR SELECT USING ( auth.uid() = user_id );

-- allow users to INSERT only for themselves
CREATE POLICY ins_own_perizinan ON public.perizinan
  FOR INSERT WITH CHECK ( auth.uid() = user_id );

-- allow users to UPDATE only their own pending requests
CREATE POLICY upd_own_perizinan ON public.perizinan
  FOR UPDATE
  USING  ( auth.uid() = user_id AND status = FALSE )
  WITH CHECK ( auth.uid() = user_id AND status = FALSE );

-- Grant privileges so the "authenticated" role can insert/select/update its own rows
GRANT SELECT, INSERT, UPDATE ON public.perizinan TO authenticated;

-- (optional) Admin role policies can be added separately
