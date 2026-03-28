-- Migration 056: Fix NM (competency_assessments) RLS policies for class_students junction table
--
-- Problem: Migration 030 RLS policies only check students.class_id (legacy direct FK).
-- After migration 041 added class_students junction table, students enrolled via junction
-- are invisible to these policies. Also fixes c.teacher_id → c.teacher_id (correct column name).
--
-- All NM routes currently use createAdminClient() (bypasses RLS), so this is a
-- defense-in-depth fix. But it must be correct before any client-side NM queries.

-- Drop old policies
DROP POLICY IF EXISTS "teachers_manage_observations" ON competency_assessments;
DROP POLICY IF EXISTS "students_read_own" ON competency_assessments;
DROP POLICY IF EXISTS "students_create_self" ON competency_assessments;

-- Teachers can manage observations for students in their classes
-- Checks BOTH junction table (class_students) AND legacy FK (students.class_id)
CREATE POLICY "teachers_manage_observations"
  ON competency_assessments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE cs.student_id = competency_assessments.student_id
        AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = competency_assessments.student_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Students can read their own assessments
CREATE POLICY "students_read_own"
  ON competency_assessments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_sessions ss
      JOIN students st ON ss.student_id = st.id
      WHERE st.id = competency_assessments.student_id
        AND ss.token = current_setting('request.cookies.student_session', true)
    )
    OR student_id::text = auth.uid()::text
  );

-- Students can create self-assessments
CREATE POLICY "students_create_self"
  ON competency_assessments
  FOR INSERT
  WITH CHECK (
    source = 'student_self'
    AND (
      EXISTS (
        SELECT 1 FROM student_sessions ss
        JOIN students st ON ss.student_id = st.id
        WHERE st.id = competency_assessments.student_id
          AND ss.token = current_setting('request.cookies.student_session', true)
      )
      OR student_id::text = auth.uid()::text
    )
  );
