-- Migration 041: Student-Class Junction Table
--
-- WHAT: Decouples students from single-class ownership. Students become
-- independent entities belonging to a teacher, enrolled in classes via junction.
--
-- WHY: Students move through multiple classes over their school career
-- (e.g. G6 Design Sem1 → G7 Design Sem2). Need to track history and allow
-- students to exist outside of any class.
--
-- STRATEGY: Additive migration — keeps students.class_id for backward compat.
-- New code uses class_students junction. Old code still works until migrated.
--
-- BACKFILL: Populates class_students from existing students.class_id data.
-- Sets author_teacher_id from classes.teacher_id (or author_teacher_id).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Add author_teacher_id to students (who owns this student record)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE students ADD COLUMN IF NOT EXISTS author_teacher_id UUID REFERENCES teachers(id);

-- Backfill from classes table (students.class_id → classes.teacher_id)
UPDATE students s
SET author_teacher_id = c.teacher_id
FROM classes c
WHERE s.class_id = c.id
  AND s.author_teacher_id IS NULL;

-- For any orphaned students (shouldn't exist, but safety), try author_teacher_id on classes
UPDATE students s
SET author_teacher_id = c.author_teacher_id
FROM classes c
WHERE s.class_id = c.id
  AND s.author_teacher_id IS NULL
  AND c.author_teacher_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Create class_students junction table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS class_students (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,

  -- Enrollment lifecycle
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unenrolled_at TIMESTAMPTZ,          -- NULL = currently enrolled
  is_active     BOOLEAN NOT NULL DEFAULT true,

  -- Per-enrollment overrides (optional)
  ell_level_override INTEGER CHECK (ell_level_override BETWEEN 1 AND 3),
  notes              TEXT,             -- Teacher notes about this enrollment

  PRIMARY KEY (student_id, class_id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_students_class    ON class_students(class_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_class_students_student  ON class_students(student_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_class_students_active   ON class_students(class_id, is_active);
CREATE INDEX IF NOT EXISTS idx_students_author_teacher ON students(author_teacher_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_class_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_class_students_updated_at ON class_students;
CREATE TRIGGER trigger_class_students_updated_at
  BEFORE UPDATE ON class_students
  FOR EACH ROW
  EXECUTE FUNCTION update_class_students_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Backfill class_students from existing students.class_id
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO class_students (student_id, class_id, enrolled_at, is_active)
SELECT id, class_id, COALESCE(created_at, NOW()), true
FROM students
WHERE class_id IS NOT NULL
ON CONFLICT (student_id, class_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Make students.class_id nullable (backward compat — deprecated)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE students ALTER COLUMN class_id DROP NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RLS Policies for class_students
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;

-- Teachers can manage enrollments for their own classes
CREATE POLICY "Teachers manage class_students"
  ON class_students FOR ALL
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE teacher_id = auth.uid()
         OR author_teacher_id = auth.uid()
    )
  );

-- Students can read their own enrollments
CREATE POLICY "Students read own enrollments"
  ON class_students FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN student_sessions ss ON ss.student_id = s.id
      WHERE ss.expires_at > NOW()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Update students RLS to include author_teacher_id ownership
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old policy and recreate with dual-path check
DROP POLICY IF EXISTS "Teachers manage students in their classes" ON students;

CREATE POLICY "Teachers manage students"
  ON students FOR ALL
  USING (
    -- Legacy path: teacher owns the class the student is in
    class_id IN (
      SELECT id FROM classes
      WHERE teacher_id = auth.uid()
         OR author_teacher_id = auth.uid()
    )
    OR
    -- New path: teacher directly owns the student
    author_teacher_id = auth.uid()
    OR
    -- Junction path: student is enrolled in one of teacher's classes
    id IN (
      SELECT cs.student_id FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE c.teacher_id = auth.uid()
         OR c.author_teacher_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Add unique constraint for username per teacher (replaces per-class)
-- ═══════════════════════════════════════════════════════════════════════════

-- Note: Can't drop old UNIQUE(username, class_id) yet since class_id is
-- still populated. Add the new one alongside it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_username_teacher
  ON students(username, author_teacher_id)
  WHERE author_teacher_id IS NOT NULL;
