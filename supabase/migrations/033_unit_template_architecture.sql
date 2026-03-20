-- Migration 033: Unit-as-Template Architecture + History-Ready Foundation
--
-- This migration makes StudioLoom's data model forward-compatible with the
-- planned multi-school architecture (see src/types/school.ts) while solving
-- the immediate NM config problem (was unit-global, now per-class).
--
-- ALL CHANGES ARE ADDITIVE — no columns removed, no relationships changed,
-- no existing queries break.
--
-- What this fixes:
-- 1. NM config was stored on units table (global) — now on class_units (per-class)
-- 2. Classes had no academic year, archive, grade level, or subject fields
-- 3. class_units had no timestamps (couldn't tell when a unit was assigned)
-- 4. student_progress had no created_at (couldn't tell when work started)
-- 5. competency_assessments had no class_id (couldn't filter NM results per-class)

-- ═══════════════════════════════════════════════════════════════
-- 1. CLASSES — academic year, archival, metadata
-- ═══════════════════════════════════════════════════════════════

-- Academic year string (e.g., "2025-2026") for filtering and archival grouping
ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- Soft archive — archived classes hide from dashboard but all data preserved
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Grade level (e.g., "Year 9", "MYP 4") — matches SchoolClass.grade_level in school.ts
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grade_level TEXT;

-- Subject (e.g., "Product Design") — matches SchoolClass.subject in school.ts
ALTER TABLE classes ADD COLUMN IF NOT EXISTS subject TEXT;

-- Indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_classes_archived ON classes(is_archived);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON classes(academic_year);
CREATE INDEX IF NOT EXISTS idx_classes_grade_level ON classes(grade_level);

-- ═══════════════════════════════════════════════════════════════
-- 2. CLASS_UNITS — per-class NM config + assignment timestamps
-- ═══════════════════════════════════════════════════════════════

-- Per-class NM config — overrides units.nm_config when present.
-- Shape: { enabled: bool, competencies: string[], elements: string[],
--          checkpoints: { [pageId]: { elements: string[] } } }
-- NULL means "use unit-level default" (backward compat)
ALTER TABLE class_units ADD COLUMN IF NOT EXISTS nm_config JSONB DEFAULT NULL;

-- When this unit was assigned to the class (for teaching history)
ALTER TABLE class_units ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- When class-unit settings were last modified
ALTER TABLE class_units ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_class_units_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS trigger_class_units_updated_at ON class_units;
CREATE TRIGGER trigger_class_units_updated_at
  BEFORE UPDATE ON class_units
  FOR EACH ROW
  EXECUTE FUNCTION update_class_units_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 3. STUDENT_PROGRESS — when work first started
-- ═══════════════════════════════════════════════════════════════

-- Add created_at column (existing rows get backfilled from updated_at)
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Backfill: set created_at = updated_at for existing rows (best we can do)
UPDATE student_progress SET created_at = updated_at WHERE created_at IS NULL;

-- Set default for new rows
ALTER TABLE student_progress ALTER COLUMN created_at SET DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════
-- 4. COMPETENCY_ASSESSMENTS — class scoping for per-class NM results
-- ═══════════════════════════════════════════════════════════════

-- Add class_id so NM results can be filtered per-class
ALTER TABLE competency_assessments ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id);

-- Index for per-class NM result queries
CREATE INDEX IF NOT EXISTS idx_competency_assessments_class ON competency_assessments(class_id);

-- Backfill class_id from student's current class (best effort for existing data)
UPDATE competency_assessments ca
SET class_id = s.class_id
FROM students s
WHERE ca.student_id = s.id
  AND ca.class_id IS NULL;
