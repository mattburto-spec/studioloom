-- Migration 093: machine_profiles table + RLS + indexes
--
-- Preflight Phase 1A-1. Creates the per-teacher machine profile registry.
-- Seeded system templates (12) land in migration 094.
--
-- Refs:
--   - Spec:     docs/projects/fabrication-pipeline.md §7
--   - Brief:    docs/projects/preflight-phase-1a-brief.md
--   - Decision: docs/projects/fabrication/phase-0-decisions.md (D-07 rule_overrides, D-10 WIRING)
--   - Lessons:  #24 (idempotent guards), #38 (verify expected values), #45 (surgical)
--
-- Ownership model:
--   - System template:  teacher_id IS NULL, is_system_template = true  (seeded in 094)
--   - Teacher-owned:    teacher_id = <auth.users.id>, is_system_template = false
--   Enforced by CHECK constraint + RLS policies.

-- ============================================================
-- 1. Create table
-- ============================================================

CREATE TABLE IF NOT EXISTS machine_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  is_system_template BOOLEAN NOT NULL DEFAULT false,

  -- Identity
  name TEXT NOT NULL,
  machine_category TEXT NOT NULL CHECK (machine_category IN ('3d_printer', 'laser_cutter')),
  machine_model TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_teacher_approval BOOLEAN NOT NULL DEFAULT false,

  -- Bed dimensions (mm); z nullable for lasers
  bed_size_x_mm NUMERIC NOT NULL,
  bed_size_y_mm NUMERIC NOT NULL,
  bed_size_z_mm NUMERIC,

  -- 3D-printer-specific (nullable for lasers)
  nozzle_diameter_mm NUMERIC,
  supported_materials JSONB,
  max_print_time_min INT,
  supports_auto_supports BOOLEAN,

  -- Laser-specific (nullable for 3D printers)
  kerf_mm NUMERIC,
  operation_color_map JSONB,
  min_feature_mm NUMERIC,

  -- Per-profile rule overrides (D-07, moved from Phase 8)
  -- Shape: { "<rule_id>": { "severity"?: "block"|"warn"|"fyi"|"off", "threshold"?: number } }
  rule_overrides JSONB,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exactly one ownership model per row
  CONSTRAINT machine_profile_ownership_check CHECK (
    (is_system_template = true  AND teacher_id IS NULL)
    OR
    (is_system_template = false AND teacher_id IS NOT NULL)
  )
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_machine_profiles_teacher_id
  ON machine_profiles(teacher_id)
  WHERE teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_machine_profiles_system_template
  ON machine_profiles(is_system_template)
  WHERE is_system_template = true;

CREATE INDEX IF NOT EXISTS idx_machine_profiles_category
  ON machine_profiles(machine_category);

-- Unique name: global for system templates, per-teacher for owned
CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_profiles_system_template_name
  ON machine_profiles(name)
  WHERE is_system_template = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_profiles_teacher_name
  ON machine_profiles(teacher_id, name)
  WHERE teacher_id IS NOT NULL;

-- ============================================================
-- 3. updated_at trigger (uses shared function from migration 030)
-- ============================================================

DROP TRIGGER IF EXISTS trigger_machine_profiles_updated_at ON machine_profiles;
CREATE TRIGGER trigger_machine_profiles_updated_at
  BEFORE UPDATE ON machine_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE machine_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: teacher sees own profiles + all system templates
DROP POLICY IF EXISTS machine_profiles_select_teacher ON machine_profiles;
CREATE POLICY machine_profiles_select_teacher
  ON machine_profiles
  FOR SELECT
  USING (
    is_system_template = true
    OR teacher_id = auth.uid()
  );

-- INSERT: teacher creates non-template rows owned by themselves
DROP POLICY IF EXISTS machine_profiles_insert_teacher ON machine_profiles;
CREATE POLICY machine_profiles_insert_teacher
  ON machine_profiles
  FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND is_system_template = false
  );

-- UPDATE: teacher updates only own non-template rows; can't escalate to system template
DROP POLICY IF EXISTS machine_profiles_update_teacher ON machine_profiles;
CREATE POLICY machine_profiles_update_teacher
  ON machine_profiles
  FOR UPDATE
  USING (
    teacher_id = auth.uid()
    AND is_system_template = false
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND is_system_template = false
  );

-- DELETE: teacher deletes only own non-template rows
DROP POLICY IF EXISTS machine_profiles_delete_teacher ON machine_profiles;
CREATE POLICY machine_profiles_delete_teacher
  ON machine_profiles
  FOR DELETE
  USING (
    teacher_id = auth.uid()
    AND is_system_template = false
  );

-- ============================================================
-- 5. Verify block (Lesson #38 — assert expected state, not just non-null)
-- ============================================================

DO $$
DECLARE
  rls_enabled    boolean;
  policy_count   int;
  expected_count int := 4;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'machine_profiles' AND relnamespace = 'public'::regnamespace;

  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'RLS not enabled on machine_profiles';
  END IF;

  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'machine_profiles' AND schemaname = 'public';

  IF policy_count <> expected_count THEN
    RAISE EXCEPTION 'Expected % policies on machine_profiles, found %', expected_count, policy_count;
  END IF;
END $$;
