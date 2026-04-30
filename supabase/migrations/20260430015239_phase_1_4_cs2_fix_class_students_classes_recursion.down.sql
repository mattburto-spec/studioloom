-- Rollback for: phase_1_4_cs2_fix_class_students_classes_recursion
-- Pairs with: 20260430015239_phase_1_4_cs2_fix_class_students_classes_recursion.sql
--
-- Restores the original migration-041 policy (which has the latent
-- recursion bug when paired with CS-1's "Students read own enrolled
-- classes"). Use only if the SECURITY DEFINER fix introduces a
-- regression.

DROP POLICY IF EXISTS "Teachers manage class_students" ON class_students;

CREATE POLICY "Teachers manage class_students"
  ON class_students
  FOR ALL
  USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
  );

DROP FUNCTION IF EXISTS public.is_teacher_of_class(uuid);
