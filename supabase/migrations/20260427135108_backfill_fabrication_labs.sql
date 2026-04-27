-- Migration: backfill_fabrication_labs
-- Created: 20260427135108 UTC
-- Phase: Preflight Phase 8-1 (school-scoped lab ownership)
--
-- WHY: After the schema migration creates the empty fabrication_labs
--   table + nullable FK columns on machine_profiles / classes /
--   teachers, this migration populates them so existing data fits
--   the new model with zero student/fabricator-visible disruption.
--
-- IDEMPOTENT: every pass guards against double-insert / double-update
--   so the migration is safe to re-run if it partially completes or
--   if Matt needs to bisect a problem.
--
-- EXCLUSION: system sentinel accounts (email LIKE '%@studioloom.internal')
--   legitimately have school_id IS NULL and never log in. Every pass
--   explicitly skips them. Per Phase 8-1 brief §4.2 + parent brief §5b.
--
-- 4 PASSES:
--   PASS 1 — One "Default lab" per school with active fabrication
--            footprint (real teacher + ≥1 non-template machine).
--   PASS 2 — Assign every real-teacher non-template machine to its
--            school's default lab.
--   PASS 3 — Set teachers.default_lab_id to the school's default lab.
--   PASS 4 — Cascade classes.default_lab_id from the owning teacher's
--            default_lab_id (set in pass 3).
--
-- VERIFICATION: trailing DO block uses RAISE NOTICE (no DECLARE
--   table-name-like vars per Lesson #51) to log orphan counts to
--   the migration log for audit. Expected: 0 real-teacher orphans.
--
-- ROLLBACK: implicit via the schema migration's .down.sql — when the
--   table goes, all backfilled lab rows die with it. Source data on
--   machine_profiles / classes / teachers is preserved (we only
--   added columns).
--
-- BRIEF: docs/projects/preflight-phase-8-1-brief.md §4.2

-- ============================================================
-- PASS 1: One "Default lab" per school with active fabrication
--         footprint. Schools with zero machines get no lab — they
--         can create one via the UI later.
-- ============================================================

INSERT INTO fabrication_labs (
  school_id,
  created_by_teacher_id,
  name,
  description
)
SELECT DISTINCT
  t.school_id                                                AS school_id,
  -- Pick the earliest-created REAL teacher at the school as
  -- the audit creator. Stable across re-runs (deterministic).
  (
    SELECT id
    FROM teachers t2
    WHERE t2.school_id = t.school_id
      AND t2.email NOT LIKE '%@studioloom.internal'
    ORDER BY t2.created_at ASC, t2.id ASC
    LIMIT 1
  )                                                          AS created_by_teacher_id,
  'Default lab'                                              AS name,
  'Auto-created during Phase 8 rollout. Rename or add more labs from /teacher/preflight/lab-setup.' AS description
FROM teachers t
WHERE
  t.school_id IS NOT NULL
  AND t.email NOT LIKE '%@studioloom.internal'
  AND EXISTS (
    SELECT 1
    FROM machine_profiles mp
    WHERE mp.teacher_id = t.id
      AND mp.is_system_template = false
  )
  -- Idempotency: skip schools that already have ANY lab. After
  -- the first run lands one Default lab per school, this clause
  -- filters them out on re-run.
  AND NOT EXISTS (
    SELECT 1
    FROM fabrication_labs fl
    WHERE fl.school_id = t.school_id
  );

-- ============================================================
-- PASS 2: Assign real-teacher non-template machines to their
--         school's default lab. System templates
--         (is_system_template = true) stay NULL — they're
--         cross-tenant seed rows, not owned by any lab.
-- ============================================================

UPDATE machine_profiles mp
SET lab_id = (
  SELECT fl.id
  FROM fabrication_labs fl
  JOIN teachers t ON t.school_id = fl.school_id
  WHERE t.id = mp.teacher_id
  -- Pick the school's earliest-created lab as the default
  -- target. Stable across re-runs.
  ORDER BY fl.created_at ASC, fl.id ASC
  LIMIT 1
)
WHERE
  mp.is_system_template = false
  AND mp.teacher_id IS NOT NULL
  AND mp.lab_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM teachers t
    WHERE t.id = mp.teacher_id
      AND t.school_id IS NOT NULL
      AND t.email NOT LIKE '%@studioloom.internal'
  );

-- ============================================================
-- PASS 3: Set teachers.default_lab_id to their school's default
--         lab. Excludes orphan teachers (school_id IS NULL) and
--         system sentinels.
-- ============================================================

UPDATE teachers t
SET default_lab_id = (
  SELECT fl.id
  FROM fabrication_labs fl
  WHERE fl.school_id = t.school_id
  ORDER BY fl.created_at ASC, fl.id ASC
  LIMIT 1
)
WHERE
  t.default_lab_id IS NULL
  AND t.school_id IS NOT NULL
  AND t.email NOT LIKE '%@studioloom.internal'
  AND EXISTS (
    SELECT 1
    FROM fabrication_labs fl
    WHERE fl.school_id = t.school_id
  );

-- ============================================================
-- PASS 4: Cascade classes.default_lab_id from the owning
--         teacher's default_lab_id (set in pass 3).
-- ============================================================

UPDATE classes c
SET default_lab_id = (
  SELECT t.default_lab_id
  FROM teachers t
  WHERE t.id = c.teacher_id
)
WHERE
  c.default_lab_id IS NULL
  AND c.teacher_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM teachers t
    WHERE t.id = c.teacher_id
      AND t.default_lab_id IS NOT NULL
  );

-- ============================================================
-- VERIFICATION (read-only, RAISE NOTICE only — no
-- table-name-like DECLARE vars per Lesson #51)
-- ============================================================

DO $$
DECLARE
  v_orphan_machines        INT;
  v_orphan_classes         INT;
  v_orphan_teachers        INT;
  v_excluded_system        INT;
  v_lab_count              INT;
BEGIN
  -- Orphan = real-teacher row that should have been backfilled
  -- but wasn't. Expected: 0 across all three passes.

  SELECT COUNT(*) INTO v_orphan_machines
  FROM machine_profiles mp
  JOIN teachers t ON t.id = mp.teacher_id
  WHERE mp.is_system_template = false
    AND mp.lab_id IS NULL
    AND t.school_id IS NOT NULL
    AND t.email NOT LIKE '%@studioloom.internal';

  SELECT COUNT(*) INTO v_orphan_classes
  FROM classes c
  JOIN teachers t ON t.id = c.teacher_id
  WHERE c.default_lab_id IS NULL
    AND t.school_id IS NOT NULL
    AND t.email NOT LIKE '%@studioloom.internal'
    AND t.default_lab_id IS NOT NULL;

  SELECT COUNT(*) INTO v_orphan_teachers
  FROM teachers
  WHERE default_lab_id IS NULL
    AND school_id IS NOT NULL
    AND email NOT LIKE '%@studioloom.internal'
    AND EXISTS (
      SELECT 1 FROM fabrication_labs fl WHERE fl.school_id = teachers.school_id
    );

  SELECT COUNT(*) INTO v_excluded_system
  FROM teachers
  WHERE email LIKE '%@studioloom.internal';

  SELECT COUNT(*) INTO v_lab_count
  FROM fabrication_labs;

  RAISE NOTICE 'Phase 8-1 backfill verification:';
  RAISE NOTICE '  fabrication_labs rows created: %', v_lab_count;
  RAISE NOTICE '  real-teacher machines still NULL (expected 0): %', v_orphan_machines;
  RAISE NOTICE '  real-teacher classes still NULL (expected 0): %', v_orphan_classes;
  RAISE NOTICE '  real-teacher teachers still NULL (expected 0): %', v_orphan_teachers;
  RAISE NOTICE '  system sentinel accounts intentionally excluded: %', v_excluded_system;
END $$;
