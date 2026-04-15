-- Migration 085: schools lookup table + teachers.school_id
--
-- Adds a forward-compatible `schools` table to back the welcome-wizard
-- school picker. Teachers pick from a seeded list (IB/CIS/ECIS) or add a
-- user_submitted entry. `teachers.school_id` is nullable so existing teachers
-- (onboarded before this migration) can backfill via settings.
--
-- Forward-compat with FU-P (school entity as tenant root):
-- * id UUID is the stable join key — FU-P layers adds billing_tier,
--   primary_admin_id, settings JSONB, branding JSONB as additive columns.
-- * parent_school_id already present for district/MAT hierarchy.
-- * verified flag ready for admin moderation of user-submitted rows.
-- * A future `school_memberships(school_id, user_id, role)` table handles
--   co-teachers and admins (FU-O); this column stays as the "primary school"
--   hint.
--
-- RLS strategy:
-- * authenticated → SELECT all rows (typeahead needs it)
-- * authenticated → INSERT only when source='user_submitted' AND
--   created_by=auth.uid() AND verified=false
-- * UPDATE / DELETE only via service role (admin moderation)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. CREATE TABLE schools
-- ============================================================

CREATE TABLE IF NOT EXISTS schools (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identity (stable across future FU-P tenant-root migration)
  name              TEXT NOT NULL,
  city              TEXT,
  country           TEXT NOT NULL,

  -- Programme affiliation (sparse; useful for IB typeahead disambiguation)
  ib_programmes     TEXT[] NOT NULL DEFAULT '{}',
  ib_school_code    TEXT,

  -- Source tracking
  source            TEXT NOT NULL CHECK (
    source IN ('ibo','cis','ecis','user_submitted','imported')
  ),
  source_ref        TEXT,

  -- Verification state — admin promotes user_submitted → verified=true
  verified          BOOLEAN NOT NULL DEFAULT false,
  verified_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- FU-P forward-compat placeholders
  parent_school_id  UUID REFERENCES schools(id) ON DELETE SET NULL,
  latitude          NUMERIC(9,6),
  longitude         NUMERIC(9,6),

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Dedup helper (case + whitespace normalized)
  normalized_name   TEXT GENERATED ALWAYS AS (
    lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
  ) STORED
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_schools_name_trgm
  ON schools USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_schools_country ON schools(country);
CREATE INDEX IF NOT EXISTS idx_schools_verified ON schools(verified);

-- Dedup: prevent exact-name duplicates within the same country.
-- normalized_name handles case + whitespace; country is ISO-2 when possible
-- but accepts full names for user_submitted rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_unique_name_country
  ON schools(normalized_name, country);

-- ============================================================
-- 3. updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION schools_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_schools_updated_at ON schools;
CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION schools_touch_updated_at();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_schools_auth" ON schools;
CREATE POLICY "read_schools_auth"
  ON schools
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_custom_schools" ON schools;
CREATE POLICY "insert_custom_schools"
  ON schools
  FOR INSERT
  TO authenticated
  WITH CHECK (
    source = 'user_submitted'
    AND verified = false
    AND created_by = auth.uid()
  );

-- UPDATE / DELETE intentionally not granted to authenticated — admin only
-- via service_role (e.g. merge duplicates, promote to verified).

-- ============================================================
-- 5. ALTER teachers — add school_id
-- ============================================================

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS school_id UUID
  REFERENCES schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school_id);

-- ============================================================
-- 6. Sanity checks
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='schools' AND column_name='normalized_name'
  ) THEN
    RAISE EXCEPTION 'Migration 085 failed: schools.normalized_name missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='teachers' AND column_name='school_id'
  ) THEN
    RAISE EXCEPTION 'Migration 085 failed: teachers.school_id missing';
  END IF;

  RAISE NOTICE 'Migration 085 applied OK: schools + teachers.school_id';
END $$;
