-- Rollback for: phase_4_7b_3_tier_gate_leak_surfaces
-- Pairs with: 20260502223059_phase_4_7b_3_tier_gate_leak_surfaces.sql
--
-- Restores the four pre-4.7b-3 RLS policies (school-wide reads with no
-- tier check) + drops the helper. Safe to run; no data dependency.

-- 1. Drop tier-gated policies
DROP POLICY IF EXISTS "audit_events_school_teacher_read"     ON audit_events;
DROP POLICY IF EXISTS "student_mentors_school_teacher_read"  ON student_mentors;
DROP POLICY IF EXISTS "school_resources_school_read"         ON school_resources;
DROP POLICY IF EXISTS "guardians_school_read"                ON guardians;

-- 2. Restore pre-4.7b-3 policies (verbatim from original migrations)

-- audit_events_school_teacher_read (mig 20260428215923)
CREATE POLICY "audit_events_school_teacher_read"
  ON audit_events FOR SELECT
  USING (
    school_id IN (
      SELECT t.school_id FROM teachers t
      WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
    )
  );

-- student_mentors_school_teacher_read (mig 20260428214735)
CREATE POLICY "student_mentors_school_teacher_read"
  ON student_mentors FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN teachers t ON t.school_id = s.school_id
      WHERE t.id = auth.uid()
        AND t.school_id IS NOT NULL
        AND s.school_id IS NOT NULL
    )
  );

-- school_resources_school_read (mig 20260428214009)
CREATE POLICY "school_resources_school_read"
  ON school_resources FOR SELECT
  USING (
    school_id IN (
      SELECT t.school_id FROM teachers t
      WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
    )
  );

-- guardians_school_read (mig 20260428214009)
CREATE POLICY "guardians_school_read"
  ON guardians FOR SELECT
  USING (
    school_id IN (
      SELECT t.school_id FROM teachers t
      WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
    )
  );

-- 3. Drop the helper
DROP FUNCTION IF EXISTS public.current_teacher_school_tier_school_id();
