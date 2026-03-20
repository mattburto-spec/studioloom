-- Migration 030: New Metrics (Melbourne Metrics) competency assessment layer
-- Adds competency_assessments table and nm_config JSONB column on units

-- 1. Competency assessments table
CREATE TABLE IF NOT EXISTS competency_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  unit_id UUID NOT NULL,
  page_id UUID,  -- nullable for teacher observations not tied to a specific page
  competency TEXT NOT NULL,  -- e.g., 'agency_in_learning'
  element TEXT NOT NULL,     -- e.g., 'acting_with_autonomy'
  source TEXT NOT NULL CHECK (source IN ('student_self', 'teacher_observation')),
  rating INTEGER NOT NULL,   -- 1-3 for student_self, 1-4 for teacher_observation
  comment TEXT,
  context JSONB DEFAULT '{}',  -- lesson name, activity type, design phase, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Rating range validation
  CONSTRAINT valid_student_rating CHECK (
    source != 'student_self' OR (rating >= 1 AND rating <= 3)
  ),
  CONSTRAINT valid_teacher_rating CHECK (
    source != 'teacher_observation' OR (rating >= 1 AND rating <= 4)
  )
);

-- Indexes for common query patterns
CREATE INDEX idx_ca_student ON competency_assessments(student_id);
CREATE INDEX idx_ca_unit ON competency_assessments(unit_id);
CREATE INDEX idx_ca_student_unit ON competency_assessments(student_id, unit_id);
CREATE INDEX idx_ca_source ON competency_assessments(source);
CREATE INDEX idx_ca_competency ON competency_assessments(competency);
CREATE INDEX idx_ca_page ON competency_assessments(page_id) WHERE page_id IS NOT NULL;

-- RLS
ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;

-- Teachers can read/write observations for students in their classes
CREATE POLICY "teachers_manage_observations"
  ON competency_assessments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = competency_assessments.student_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Students can read their own assessments and create self-assessments
CREATE POLICY "students_read_own"
  ON competency_assessments
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "students_create_self"
  ON competency_assessments
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND source = 'student_self'
  );

-- 2. Add nm_config JSONB column to units table
-- Shape: { enabled: bool, competencies: string[], elements: string[], checkpoints: { [pageId]: { elements: string[] } } }
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'units' AND column_name = 'nm_config'
  ) THEN
    ALTER TABLE units ADD COLUMN nm_config JSONB DEFAULT NULL;
  END IF;
END $$;

-- 3. Updated_at trigger for competency_assessments (using existing trigger function if available)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
