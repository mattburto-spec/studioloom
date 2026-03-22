-- ═══════════════════════════════════════════════════════════════
-- Migration 039: Badge Class & Student Targeting
-- ═══════════════════════════════════════════════════════════════
-- Adds class-level and student-level targeting to badge requirements.
-- Previously, assigning a badge to a unit affected ALL classes using that unit.
-- Now teachers can target a specific class, and optionally specific students
-- (e.g., late arrivals who missed the original test window).
--
-- If class_id IS NULL, the requirement applies to all classes with that unit
-- (backward compatible with existing data).
-- If target_student_ids IS NULL or empty, all students in the class see the test.
-- If target_student_ids has values, only those specific students see it.

-- Add class targeting column
ALTER TABLE unit_badge_requirements
  ADD COLUMN IF NOT EXISTS class_id TEXT;

-- Add student targeting column (JSONB array of student IDs)
ALTER TABLE unit_badge_requirements
  ADD COLUMN IF NOT EXISTS target_student_ids JSONB DEFAULT NULL;

-- Drop the old unique constraint and add a new one that includes class_id
-- (same badge can be required for different classes on the same unit)
ALTER TABLE unit_badge_requirements
  DROP CONSTRAINT IF EXISTS unit_badge_requirements_unit_id_badge_id_key;

ALTER TABLE unit_badge_requirements
  ADD CONSTRAINT unit_badge_requirements_unit_badge_class_key
  UNIQUE(unit_id, badge_id, class_id);

-- Index for class-based lookups
CREATE INDEX IF NOT EXISTS idx_unit_badge_reqs_class
  ON unit_badge_requirements(class_id);
