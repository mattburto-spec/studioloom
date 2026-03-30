-- Migration 059: Fix student_progress RLS policy for class_students junction
--
-- The original "Teachers read student progress" policy only checks the legacy
-- students.class_id → classes path. Students enrolled via class_students junction
-- (migration 041) have class_id = NULL, making their progress invisible to teachers.
-- Same issue existed for planning_tasks.
--
-- Fix: DROP + recreate both policies to check BOTH paths (junction OR legacy).

-- student_progress
DROP POLICY IF EXISTS "Teachers read student progress" ON student_progress;

CREATE POLICY "Teachers read student progress"
  ON student_progress FOR SELECT
  USING (
    student_id IN (
      -- Path 1: class_students junction table
      SELECT cs.student_id FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE c.teacher_id = auth.uid()
      UNION
      -- Path 2: legacy students.class_id
      SELECT s.id FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- planning_tasks (same pattern)
DROP POLICY IF EXISTS "Teachers read planning tasks" ON planning_tasks;

CREATE POLICY "Teachers read planning tasks"
  ON planning_tasks FOR SELECT
  USING (
    student_id IN (
      SELECT cs.student_id FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE c.teacher_id = auth.uid()
      UNION
      SELECT s.id FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );
