-- Migration: unit_briefs_table
-- Created: 20260513092021 UTC
-- Phase: Unit Briefs Foundation Phase A.1 — first of two schema migrations
--
-- WHY: Solves the "students forget the brief by week 4" problem. Today
--   teachers write a design brief + constraints once at unit start,
--   students look at it in week 1 then lose track of it. This table is
--   the SOURCE — one row per unit holding the brief prose + structured
--   constraints. A persistent student-chrome chip (Phase C) and an
--   append-only amendments stream (Phase A.1 migration 2) build on top.
--
-- IMPACT:
--   1 NEW table: unit_briefs
--     - One row per unit. PK = unit_id (fully constrains uniqueness).
--     - brief_text: prose for the scenario / client request.
--     - constraints: JSONB. v1 carries Design archetype only:
--         { archetype: "design",
--           data: { dimensions?, materials_whitelist?[], budget?,
--                   audience?, must_include?[], must_avoid?[] } }
--       Non-Design units fall back to { archetype: "generic", data: {} }
--       and the teacher uses brief_text alone. Real Service / Inquiry /
--       PP archetype schemas are deferred (FU-BRIEFS-SERVICE-INQUIRY-
--       ARCHETYPES) until real classroom signal.
--     - created_by: teacher UUID. References auth.users(id).
--   1 RLS policy: teacher SELECT — author OR co-teacher (via class_units
--     join) OR platform admin (user_profiles.is_platform_admin escape
--     hatch). All writes go through service-role API (teacher API uses
--     createAdminClient like v2 product-brief). Students read via
--     service-role + token-session validation (Lesson #4 — no student
--     RLS policy needed).
--
-- DEPENDENCIES:
--   - units (existing — FK target, ON DELETE CASCADE)
--   - classes, class_units (existing — used by RLS join for co-teachers)
--   - user_profiles (existing — platform-admin escape hatch, OR'd into
--     the teacher_read policy per the v2 product-brief pattern)
--   - auth.users (existing — created_by FK target)
--   - set_updated_at() function (shared trigger pattern; idempotent
--     CREATE OR REPLACE in case it doesn't exist)
--
-- RLS NOTE (deviation from brief): The brief proposed three separate
--   policies (teacher_owns FOR ALL, class_teacher_read FOR SELECT,
--   admin_all FOR ALL). Pre-flight registry cross-check found the
--   v2 product-brief migration (applied + smoke-verified live) uses a
--   single combined teacher_read SELECT policy with admin OR'd in,
--   relying on service-role for all writes. Adopted that pattern here
--   (Lesson #45 surgical: don't invent a new RLS shape when a working
--   one exists). Also: the brief referenced `public.platform_admins`
--   which does not exist; the canonical pattern is
--   `(SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid())`.
--
-- ROLLBACK: paired .down.sql drops the table. Safety guard refuses if
--   any row has non-NULL brief_text OR a non-empty constraints JSONB
--   (= teacher work present).

CREATE TABLE IF NOT EXISTS unit_briefs (
  unit_id     UUID PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,

  brief_text  TEXT,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE unit_briefs IS
  'Unit Briefs Foundation — one row per unit holding the teacher-authored '
  'brief prose + structured constraints. Read at render time by the student '
  'BoldTopNav chip + drawer (loose-coupling per Lesson #86: no copy into '
  'downstream activity blocks). Append-only iteration via unit_brief_amendments.';

COMMENT ON COLUMN unit_briefs.constraints IS
  'Archetype-discriminated JSONB. v1 shapes: '
  '{ archetype: "design", data: { dimensions?, materials_whitelist?[], budget?, audience?, must_include?[], must_avoid?[] } } '
  'or { archetype: "generic", data: {} } as fallback for non-Design units. '
  'Validated app-side; no DB CHECK so we can extend archetypes without migration.';

-- RLS — single combined teacher_read SELECT policy (v2 pattern).
-- All writes through service-role API. Students read via service-role.
ALTER TABLE unit_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_briefs_teacher_read"
  ON unit_briefs FOR SELECT
  TO authenticated
  USING (
    -- Author of the unit
    EXISTS (
      SELECT 1 FROM units u
      WHERE u.id = unit_briefs.unit_id
        AND u.author_teacher_id = auth.uid()
    )
    -- Co-teacher with the unit assigned to one of their active classes
    OR EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = unit_briefs.unit_id
        AND cu.is_active = true
        AND c.teacher_id = auth.uid()
    )
    -- Platform admin escape hatch
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- updated_at trigger (function is idempotent across migrations)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_unit_briefs_updated_at
  BEFORE UPDATE ON unit_briefs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sanity check — assert expected values not just non-null (Lesson #38).
DO $$
DECLARE
  v_table_exists  BOOLEAN;
  v_rls_enabled   BOOLEAN;
  v_policy_count  INT;
  v_trigger_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unit_briefs'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: unit_briefs table not created';
  END IF;

  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'unit_briefs' AND relnamespace = 'public'::regnamespace;
  IF v_rls_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on unit_briefs (got %)', v_rls_enabled;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'unit_briefs';
  IF v_policy_count <> 1 THEN
    RAISE EXCEPTION 'Migration failed: expected exactly 1 RLS policy, got %', v_policy_count;
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'unit_briefs'::regclass AND NOT tgisinternal;
  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Migration failed: expected exactly 1 trigger on unit_briefs, got %', v_trigger_count;
  END IF;

  RAISE NOTICE 'Migration unit_briefs applied OK: 1 table, 1 RLS policy, 1 trigger, RLS enabled';
END $$;
