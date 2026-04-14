-- Migration 078: FU-N Option C — dual-visibility RLS on student_content_moderation_log
--
-- Problem: The SELECT + UPDATE policies from migration 073 use
--   class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
-- When class_id IS NULL (14 of 17 writer call sites pass NULL by design),
-- SQL NULL IN (...) evaluates to NULL (not TRUE), silently filtering the row.
-- Teachers never see moderation events from Discovery, Open Studio, uploads,
-- tool sessions, quest evidence, etc.
--
-- Fix: Lesson #29 UNION pattern. Keep the class_id path for rows that have it,
-- add a student_id fallback for NULL-class_id rows. Both student→teacher paths
-- (class_students junction + legacy students.class_id) are in the UNION.
--
-- FU-N-followup: Replace with Option B (admin queue) when FU-O roles ship.
-- That removes the student_id cross-join from the hot path and adds an explicit
-- safety_lead role for NULL-class events.
--
-- Peer table note: content_moderation_log (migration 067) does NOT have this
-- issue — it has no class_id column and uses a service-role-only policy
-- (USING (false) WITH CHECK (false)). No dual-visibility needed there.

-- ============================================================
-- 1. Drop existing SELECT + UPDATE policies (idempotent guards)
-- ============================================================

DROP POLICY IF EXISTS student_moderation_log_teacher_select
  ON student_content_moderation_log;

DROP POLICY IF EXISTS student_moderation_log_teacher_update
  ON student_content_moderation_log;

-- ============================================================
-- 2. Recreate SELECT with dual-visibility (Lesson #29 UNION)
-- ============================================================

CREATE POLICY student_moderation_log_teacher_select
  ON student_content_moderation_log
  FOR SELECT
  USING (
    -- Path 1: class_id set, teacher owns the class
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
    OR
    -- Path 2: class_id NULL, student belongs to one of teacher's classes
    (class_id IS NULL AND student_id IN (
      -- Junction path (class_students, migration 041)
      SELECT cs.student_id
      FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE c.teacher_id = auth.uid()
      UNION
      -- Legacy direct path (students.class_id, migration 001)
      SELECT s.id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    ))
  );

-- ============================================================
-- 3. Recreate UPDATE with same dual-visibility
-- ============================================================
-- Teachers who can see a NULL-class row should be able to review it
-- (teacher_reviewed, teacher_action, teacher_reviewed_at fields).

CREATE POLICY student_moderation_log_teacher_update
  ON student_content_moderation_log
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
    OR
    (class_id IS NULL AND student_id IN (
      SELECT cs.student_id
      FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE c.teacher_id = auth.uid()
      UNION
      SELECT s.id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    ))
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
    OR
    (class_id IS NULL AND student_id IN (
      SELECT cs.student_id
      FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE c.teacher_id = auth.uid()
      UNION
      SELECT s.id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    ))
  );
