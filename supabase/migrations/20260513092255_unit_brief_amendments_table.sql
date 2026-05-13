-- Migration: unit_brief_amendments_table
-- Created: 20260513092255 UTC
-- Phase: Unit Briefs Foundation Phase A.1 — second of two schema migrations
--
-- WHY: Append-only iteration stream on top of unit_briefs. Real client
--   work generates change orders ("v2.0 — add LEDs to your microbit
--   robot"); we want teachers to model that pattern instead of editing
--   the original brief in-place. Each row is one amendment with its own
--   version label, title, and prose body. The drawer renders them
--   chronologically below the original brief.
--
-- IMPACT:
--   1 NEW table: unit_brief_amendments
--     - One row per amendment. UUID PK so a unit can have many.
--     - unit_id FK with ON DELETE CASCADE.
--     - version_label: free text capped 20 chars (e.g. "v1.1", "v2.0",
--       "v1.5-emergency"). No format enforced — teacher discipline only
--       (Phase D.2 decision).
--     - title + body: NOT NULL (Phase D.2 validation).
--     - No updated_at: amendments are immutable. Once filed, they're
--       part of the unit history.
--   1 index: idx_unit_brief_amendments_unit_id_created_at on
--     (unit_id, created_at DESC) — supports both "latest first" teacher
--     review and "oldest first" student drawer order (PG scans index in
--     either direction).
--   1 RLS policy: same shape as unit_briefs — teacher SELECT for author
--     OR co-teacher OR platform admin. Service-role for all writes.
--
-- DEPENDENCIES:
--   - units (existing — FK target, ON DELETE CASCADE)
--   - classes, class_units (existing — used by RLS join)
--   - user_profiles (existing — admin escape hatch)
--   - auth.users (existing — created_by FK target)
--
-- ROLLBACK: paired .down.sql drops the table. Safety guard refuses if
--   any row exists at all — amendments by definition are teacher work
--   that's been published to students; rolling back blind would
--   silently strip the iteration history.

CREATE TABLE IF NOT EXISTS unit_brief_amendments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  unit_id       UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  version_label TEXT NOT NULL CHECK (char_length(version_label) BETWEEN 1 AND 20),
  title         TEXT NOT NULL CHECK (char_length(title) > 0),
  body          TEXT NOT NULL CHECK (char_length(body) > 0),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE unit_brief_amendments IS
  'Append-only iteration log on unit_briefs. Each row is a teacher-issued '
  'amendment ("v2.0 add LEDs"). Rendered chronologically in the student '
  'drawer. No edits, no deletes via app — the amendment history IS the brief''s '
  'evolution story.';

CREATE INDEX IF NOT EXISTS idx_unit_brief_amendments_unit_id_created_at
  ON unit_brief_amendments (unit_id, created_at DESC);

-- RLS — single combined teacher_read SELECT policy (mirrors unit_briefs).
-- All writes through service-role API. Students read via service-role.
ALTER TABLE unit_brief_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_brief_amendments_teacher_read"
  ON unit_brief_amendments FOR SELECT
  TO authenticated
  USING (
    -- Author of the unit
    EXISTS (
      SELECT 1 FROM units u
      WHERE u.id = unit_brief_amendments.unit_id
        AND u.author_teacher_id = auth.uid()
    )
    -- Co-teacher with the unit assigned to one of their active classes
    OR EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = unit_brief_amendments.unit_id
        AND cu.is_active = true
        AND c.teacher_id = auth.uid()
    )
    -- Platform admin escape hatch
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- Sanity check — assert expected values not just non-null (Lesson #38).
DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_rls_enabled  BOOLEAN;
  v_policy_count INT;
  v_index_count  INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unit_brief_amendments'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: unit_brief_amendments table not created';
  END IF;

  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'unit_brief_amendments' AND relnamespace = 'public'::regnamespace;
  IF v_rls_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on unit_brief_amendments (got %)', v_rls_enabled;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'unit_brief_amendments';
  IF v_policy_count <> 1 THEN
    RAISE EXCEPTION 'Migration failed: expected exactly 1 RLS policy, got %', v_policy_count;
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'unit_brief_amendments'
    AND indexname = 'idx_unit_brief_amendments_unit_id_created_at';
  IF v_index_count <> 1 THEN
    RAISE EXCEPTION 'Migration failed: expected idx_unit_brief_amendments_unit_id_created_at index, got % matches', v_index_count;
  END IF;

  RAISE NOTICE 'Migration unit_brief_amendments applied OK: 1 table, 1 RLS policy, 1 index, RLS enabled';
END $$;
