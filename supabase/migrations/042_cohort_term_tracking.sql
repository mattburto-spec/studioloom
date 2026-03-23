-- Migration 042: Cohort term tracking on class_students
--
-- Links student enrollments to school calendar terms for cohort rotation.
-- A "cohort" = all students enrolled in a class during a specific term.
-- Teachers rotate cohorts each semester without creating new classes.
--
-- DEPENDENCY: school_calendar_terms table (created in migration 037).
-- This migration safely creates it IF NOT EXISTS for environments
-- where 037 hasn't been applied yet.

-- ═══════════════════════════════════════════════════════════════
-- 1. Ensure school_calendar_terms table exists
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS school_calendar_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  academic_year TEXT NOT NULL,
  term_name TEXT NOT NULL,
  term_order INT NOT NULL DEFAULT 1,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(teacher_id, academic_year, term_name)
);

-- RLS (safe: IF NOT EXISTS not available for policies, so use DO block)
ALTER TABLE school_calendar_terms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_calendar_terms' AND policyname = 'Teachers read own calendar') THEN
    CREATE POLICY "Teachers read own calendar" ON school_calendar_terms FOR SELECT USING (teacher_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_calendar_terms' AND policyname = 'Teachers create own calendar terms') THEN
    CREATE POLICY "Teachers create own calendar terms" ON school_calendar_terms FOR INSERT WITH CHECK (teacher_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_calendar_terms' AND policyname = 'Teachers update own calendar terms') THEN
    CREATE POLICY "Teachers update own calendar terms" ON school_calendar_terms FOR UPDATE USING (teacher_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_calendar_terms' AND policyname = 'Teachers delete own calendar terms') THEN
    CREATE POLICY "Teachers delete own calendar terms" ON school_calendar_terms FOR DELETE USING (teacher_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_calendar_terms' AND policyname = 'Service role full access calendar') THEN
    CREATE POLICY "Service role full access calendar" ON school_calendar_terms FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_school_calendar_teacher_year ON school_calendar_terms(teacher_id, academic_year);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_school_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_school_calendar_updated_at ON school_calendar_terms;
CREATE TRIGGER trigger_school_calendar_updated_at
  BEFORE UPDATE ON school_calendar_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_school_calendar_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 2. Add term_id to class_students for cohort tracking
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE class_students
  ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES school_calendar_terms(id) ON DELETE SET NULL;

-- Index for grouping enrollments by term (cohort queries)
CREATE INDEX IF NOT EXISTS idx_class_students_term ON class_students(term_id) WHERE term_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_class_students_class_term ON class_students(class_id, term_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. Add term_id + schedule_overrides to class_units (from 037)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE class_units ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES school_calendar_terms(id) ON DELETE SET NULL;
ALTER TABLE class_units ADD COLUMN IF NOT EXISTS schedule_overrides JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_class_units_term ON class_units(term_id) WHERE term_id IS NOT NULL;
