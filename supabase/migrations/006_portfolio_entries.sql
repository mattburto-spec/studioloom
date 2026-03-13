-- Migration 006: Portfolio entries for Quick Capture

CREATE TABLE portfolio_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'entry' CHECK (type IN ('entry', 'photo', 'link', 'note', 'mistake')),
  content TEXT,
  media_url TEXT,
  link_url TEXT,
  link_title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_portfolio_entries_student_unit
  ON portfolio_entries(student_id, unit_id);
CREATE INDEX idx_portfolio_entries_student_created
  ON portfolio_entries(student_id, created_at DESC);

-- RLS
ALTER TABLE portfolio_entries ENABLE ROW LEVEL SECURITY;

-- Teachers can read portfolio entries for their students
CREATE POLICY "Teachers read portfolio entries"
  ON portfolio_entries FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );
