-- Migration 037: School Calendar — teacher-defined term structure
--
-- Teachers define their school's term structure once in settings.
-- Each teacher has their own calendar (schools use different term systems).
-- When assigning a unit to a class, the teacher picks which term it runs in.

-- ═══════════════════════════════════════════════════════════════
-- 1. SCHOOL_CALENDAR_TERMS — teacher-defined academic calendar
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS school_calendar_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  academic_year TEXT NOT NULL,        -- e.g. "2025-2026"
  term_name TEXT NOT NULL,            -- e.g. "Term 1", "Semester 1"
  term_order INT NOT NULL DEFAULT 1,  -- ordering within the academic year
  start_date DATE,                    -- optional start date
  end_date DATE,                      -- optional end date
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Each teacher has unique term names per academic year (can't have two "Term 1"s)
  UNIQUE(teacher_id, academic_year, term_name)
);

-- ═══════════════════════════════════════════════════════════════
-- 2. CLASS_UNITS — add term_id for unit-to-term assignment
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE class_units ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES school_calendar_terms(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE school_calendar_terms ENABLE ROW LEVEL SECURITY;

-- Teachers see only their own calendar
CREATE POLICY "Teachers read own calendar" ON school_calendar_terms FOR SELECT USING (teacher_id = auth.uid());

-- Teachers can insert their own terms
CREATE POLICY "Teachers create own calendar terms" ON school_calendar_terms FOR INSERT WITH CHECK (teacher_id = auth.uid());

-- Teachers can update their own terms
CREATE POLICY "Teachers update own calendar terms" ON school_calendar_terms FOR UPDATE USING (teacher_id = auth.uid());

-- Teachers can delete their own terms (on delete cascade to class_units term_id)
CREATE POLICY "Teachers delete own calendar terms" ON school_calendar_terms FOR DELETE USING (teacher_id = auth.uid());

-- Service role bypass for admin operations
CREATE POLICY "Service role full access calendar" ON school_calendar_terms FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 4. INDEXES for common queries
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_school_calendar_teacher_year ON school_calendar_terms(teacher_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_class_units_term ON class_units(term_id) WHERE term_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 5. AUTO-UPDATE TRIGGER
-- ═══════════════════════════════════════════════════════════════

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
