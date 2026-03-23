-- Migration 043: Add graduation_year to students
-- Enables filtering students by graduation year when adding to classes.
-- Graduation year is stable (never changes) unlike grade level which shifts yearly.
-- Example: a student graduating in 2028 is always "Class of 2028" regardless of
-- whether they're currently in Year 7, Year 8, or Grade 9.

-- 1. Add graduation_year column (nullable — teachers set it gradually)
ALTER TABLE students ADD COLUMN IF NOT EXISTS graduation_year INTEGER;

-- 2. Index for filtering students by graduation year
CREATE INDEX IF NOT EXISTS idx_students_graduation_year
  ON students(graduation_year)
  WHERE graduation_year IS NOT NULL;

-- 3. Composite index: teacher + graduation year (common query pattern)
CREATE INDEX IF NOT EXISTS idx_students_teacher_grad_year
  ON students(author_teacher_id, graduation_year);
