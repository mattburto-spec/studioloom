-- Rollback for: fix_students_teachers_with_check
-- Pairs with: 20260430053105_fix_students_teachers_with_check.sql
--
-- Restores the broken FOR ALL "Teachers manage students" policy from
-- the CS-2 hotfix (20260430010922). After rollback, INSERTs into
-- students via non-admin clients will fail with "new row violates
-- row-level security policy". Use only if the split-policy approach
-- introduces a worse regression.

DROP POLICY IF EXISTS "Teachers SELECT students" ON students;
DROP POLICY IF EXISTS "Teachers UPDATE students" ON students;
DROP POLICY IF EXISTS "Teachers DELETE students" ON students;
DROP POLICY IF EXISTS "Teachers INSERT students" ON students;

CREATE POLICY "Teachers manage students"
  ON students
  FOR ALL
  USING (public.is_teacher_of_student(id))
  WITH CHECK (public.is_teacher_of_student(id));
