-- Rollback for: phase_1_4_cs2_fix_students_rls_recursion
-- Pairs with: 20260430010922_phase_1_4_cs2_fix_students_rls_recursion.sql
--
-- Restores the ORIGINAL inlined-subquery policy (which has the latent
-- recursion bug). Use this rollback only if the SECURITY DEFINER fix
-- introduces a regression that's worse than the recursion bug.
--
-- After rollback: students RLS evaluation will recurse again under SSR
-- client. Routes using SSR client + students reads will fail with the
-- "infinite recursion" error. Stick with the rollback only if you also
-- revert the CS-2 SSR client switch on the affected routes.

DROP POLICY IF EXISTS "Teachers manage students" ON students;

CREATE POLICY "Teachers manage students"
  ON students
  FOR ALL
  USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    OR author_teacher_id = auth.uid()
    OR id IN (
      SELECT cs.student_id FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

DROP FUNCTION IF EXISTS public.is_teacher_of_student(uuid);
