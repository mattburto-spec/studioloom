-- Migration: archive_class_auto_unenroll
-- Created: 20260428081225 UTC
--
-- WHY: When a teacher archives a class (`classes.is_archived = true`), the
-- enrollments in `class_students` for that class were not auto-cleaned. Their
-- `is_active` flag stayed `true` and `unenrolled_at` stayed NULL. This created
-- a divergence between archive status (per-class) and enrollment status
-- (per-student-class). Symptoms surfaced 28 Apr 2026:
--   - The student-session resolver could pick an archived class as the
--     student's "current" class (Bug 4 — patched at query level via
--     filterOutArchivedClasses, but the underlying data is still wrong).
--   - Anyone querying class_students directly (admin tools, CSV exports,
--     future analytics) sees archived-class enrollments as "active".
--   - student `test` ended up with 2 active enrollments in archived classes
--     after a teacher archived two of his classes earlier in the day.
--
-- Filed as §1 of `docs/projects/class-architecture-cleanup.md` and chosen
-- as the smallest meaningful follow-up because it's independent of Access
-- Model v2 + closes a real data-vs-resolver gap.
--
-- IMPACT:
--   - New trigger `trigger_class_archive_unenroll_students` on `classes`:
--     fires AFTER UPDATE when `is_archived` flips from false→true. Sets
--     `is_active = false` + `unenrolled_at = NOW()` on every active
--     class_students row for that class.
--   - One-time backfill: same UPDATE for any rows currently in the
--     "active enrollment in archived class" state.
--   - `is_archived = true → false` (un-archive) does NOT auto-re-enroll
--     students. Re-enrolling someone is a deliberate teacher action; doing
--     it implicitly via un-archive would be destructive surprise.
--
-- ROLLBACK: paired .down.sql drops the trigger + function. The backfilled
-- `is_active = false` rows are NOT reverted — that's the point of the
-- backfill, and Bug 4's resolver-level filter would just re-hide them.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Trigger function
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION class_archive_unenroll_students()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when is_archived transitions false→true. NULL→true also counts
  -- (treat NULL as effectively false — older rows pre-dated the column).
  IF (NEW.is_archived = true)
     AND (OLD.is_archived IS DISTINCT FROM true) THEN
    UPDATE class_students
    SET is_active = false,
        unenrolled_at = COALESCE(unenrolled_at, NOW())
    WHERE class_id = NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_class_archive_unenroll_students ON classes;
CREATE TRIGGER trigger_class_archive_unenroll_students
  AFTER UPDATE OF is_archived ON classes
  FOR EACH ROW
  EXECUTE FUNCTION class_archive_unenroll_students();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. One-time backfill — clean up the existing data drift
-- ═══════════════════════════════════════════════════════════════════════════

-- Rows where the class is archived but the enrollment still says "active":
-- this is exactly the state the trigger will prevent going forward. Apply
-- the same fix retroactively. Idempotent (only matches dirty rows).

UPDATE class_students cs
SET is_active = false,
    unenrolled_at = COALESCE(cs.unenrolled_at, NOW())
FROM classes c
WHERE cs.class_id = c.id
  AND c.is_archived = true
  AND cs.is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Verify (informational — these queries should both return 0)
-- ═══════════════════════════════════════════════════════════════════════════

-- Quick post-apply sanity check, run manually after migration:
--
--   -- Should be 0: any active enrollments in archived classes after backfill?
--   SELECT count(*)
--   FROM class_students cs JOIN classes c ON c.id = cs.class_id
--   WHERE c.is_archived = true AND cs.is_active = true;
--
--   -- Should be 0 after a fresh archive: trigger fires + no leakage
--   -- (manual trigger test):
--   --   1. Pick a non-archived class with active enrollments
--   --   2. UPDATE classes SET is_archived = true WHERE id = '<picked>';
--   --   3. SELECT count(*) FROM class_students
--   --      WHERE class_id = '<picked>' AND is_active = true;
--   --   4. Set archive back: UPDATE classes SET is_archived = false WHERE id = '<picked>';
--   --      (un-archive is intentionally a no-op on enrollments — they stay
--   --       unenrolled; teacher must re-enroll deliberately.)
