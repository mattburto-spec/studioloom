-- 019: Assessment Records — teacher grades & feedback per student per unit
-- Stores the full AssessmentRecord (criterion scores, comments, targets, tags)
-- as JSONB with denormalized columns for queries.
-- Framework-agnostic: no CHECK constraints on grade values — scale varies by curriculum.

-- ============================================================
-- 1. Assessment Records table
-- ============================================================

CREATE TABLE assessment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Full assessment payload (AssessmentRecord as JSONB)
  data JSONB NOT NULL,

  -- Denormalized for queries (no CHECK — scale-agnostic)
  overall_grade SMALLINT,
  is_draft BOOLEAN NOT NULL DEFAULT true,

  assessed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One assessment per student per unit per class
  UNIQUE(student_id, unit_id, class_id)
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX idx_assessment_records_student_unit
  ON assessment_records(student_id, unit_id);

CREATE INDEX idx_assessment_records_class_unit
  ON assessment_records(class_id, unit_id);

CREATE INDEX idx_assessment_records_teacher
  ON assessment_records(teacher_id);

CREATE INDEX idx_assessment_records_draft
  ON assessment_records(is_draft)
  WHERE is_draft = true;

-- ============================================================
-- 3. RLS Policies
-- ============================================================

ALTER TABLE assessment_records ENABLE ROW LEVEL SECURITY;

-- Teachers can manage assessments for students in their classes
CREATE POLICY "Teachers manage assessments for their students"
  ON assessment_records FOR ALL
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

-- Service role full access (for API routes / background jobs)
CREATE POLICY "Service role full access assessments"
  ON assessment_records FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 4. Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_assessment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assessment_records_updated_at
  BEFORE UPDATE ON assessment_records
  FOR EACH ROW EXECUTE FUNCTION update_assessment_records_updated_at();
