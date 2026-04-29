-- Migration: phase_0_8b_tighten_not_null
-- Created: 20260428222049 UTC
-- Phase: Access Model v2 Phase 0.8b (schema change — NOT NULL tighten)
--
-- WHY: After 0.8a backfill cleans every NULL school_id across teachers
--   / students / units / classes, this migration tightens the three
--   columns that were originally added nullable as forward-compat
--   seams to NOT NULL. Phase 1+ permission helpers and RLS predicates
--   rely on the invariant "every student / unit / class has a
--   school_id". Without NOT NULL the planner can't fully use the
--   single-column-predicate optimisation and route logic has to
--   defensive-check.
--
--   - students.school_id  (added Phase 0.3, backfilled Phase 0.3 + 0.8a)
--   - units.school_id     (added Phase 0.3, backfilled Phase 0.3 + 0.8a)
--   - classes.school_id   (added mig 117 reserved, backfilled... wait —
--                          NOT explicitly backfilled by 0.8a! See
--                          guard below.)
-- IMPACT: 3 ALTER COLUMN SET NOT NULL. If any column has NULL rows,
--   the ALTER fails fast (postgres prevents it). RAISE EXCEPTION
--   guards check ahead of each ALTER for clearer error messages.
-- ROLLBACK: paired .down.sql sets each back to NULL-allowed.
--
-- IMPORTANT: this migration ASSUMES 0.8a ran first AND classes.school_id
-- has been backfilled via either (a) Phase 8 fabrication-labs work
-- (which already populated NIS classes via the teacher chain), OR
-- (b) Matt's manual SQL between 0.8a and 0.8b for any classes still
-- showing NULL school_id (warning surfaces in 0.8a's apply log).
--
-- Pre-flight assertions guard against 0.8a not having run or having
-- left NULLs — the migration fails loudly with actionable error
-- messages rather than silently leaving the database in mixed state.

DO $$
DECLARE
  null_students INTEGER;
  null_units    INTEGER;
  null_classes  INTEGER;
BEGIN
  -- Pre-flight guards: check every column is fully populated.
  SELECT COUNT(*) INTO null_students FROM students WHERE school_id IS NULL;
  SELECT COUNT(*) INTO null_units    FROM units    WHERE school_id IS NULL;
  SELECT COUNT(*) INTO null_classes  FROM classes  WHERE school_id IS NULL;

  IF null_students > 0 THEN
    RAISE EXCEPTION
      'Phase 0.8b: cannot tighten students.school_id NOT NULL — % rows still NULL. Run Phase 0.8a first OR investigate stuck orphans.',
      null_students;
  END IF;

  IF null_units > 0 THEN
    RAISE EXCEPTION
      'Phase 0.8b: cannot tighten units.school_id NOT NULL — % rows still NULL. Run Phase 0.8a first OR investigate stuck orphans.',
      null_units;
  END IF;

  IF null_classes > 0 THEN
    RAISE EXCEPTION
      'Phase 0.8b: cannot tighten classes.school_id NOT NULL — % rows still NULL. classes.school_id was reserved nullable by mig 117 but never explicitly backfilled by 0.8a. Either backfill manually (UPDATE classes SET school_id = (SELECT t.school_id FROM teachers t WHERE t.id = classes.teacher_id) WHERE school_id IS NULL AND teacher_id IS NOT NULL) or leave classes.school_id nullable for v2 and revisit in Phase 6 cutover.',
      null_classes;
  END IF;

  RAISE NOTICE '[Phase 0.8b] Pre-flight clean: students/units/classes school_id all populated. Tightening to NOT NULL.';
END $$;

-- ============================================================
-- Tighten the three columns
-- ============================================================

ALTER TABLE students ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE units    ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE classes  ALTER COLUMN school_id SET NOT NULL;

-- ============================================================
-- Sanity check
-- ============================================================

DO $$
DECLARE
  pair RECORD;
  expected RECORD;
BEGIN
  FOR pair IN
    SELECT 'students' AS t, 'school_id' AS c
    UNION ALL SELECT 'units', 'school_id'
    UNION ALL SELECT 'classes', 'school_id'
  LOOP
    SELECT is_nullable INTO expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = pair.t
      AND column_name = pair.c;

    IF expected.is_nullable != 'NO' THEN
      RAISE EXCEPTION 'Phase 0.8b: %.% is still nullable after tighten — alter failed', pair.t, pair.c;
    END IF;
  END LOOP;

  RAISE NOTICE '[Phase 0.8b] DONE — students.school_id + units.school_id + classes.school_id all NOT NULL';
END $$;
