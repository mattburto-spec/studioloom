-- Rollback for: phase_3_4f_is_teacher_of_student_includes_class_members_and_mentors
-- Pairs with: 20260501142442_phase_3_4f_is_teacher_of_student_includes_class_members_and_mentors.sql
--
-- Restores the pre-Phase-3.4f body of public.is_teacher_of_student —
-- 3 legacy paths only (students.class_id, author_teacher_id, enrollment
-- chain via classes.teacher_id). Co_teacher / dept_head / mentor lose
-- students access; lead_teacher path unaffected.

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(student_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_uuid
      AND (
        s.class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
        OR s.author_teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_students cs
          JOIN classes c ON cs.class_id = c.id
          WHERE cs.student_id = s.id AND c.teacher_id = auth.uid()
        )
      )
  );
$$;
