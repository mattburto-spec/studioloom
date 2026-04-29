-- Phase 1.5 — design_conversations + design_conversation_turns: rewrite student-side RLS
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.5
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY (audit finding from Phase 1.5 pre-flight)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 022 added 2 student-side policies on design_conversations +
-- design_conversation_turns:
--
--   "Students can manage own conversations"
--     ON design_conversations FOR ALL
--     USING (student_id = auth.uid())
--     WITH CHECK (student_id = auth.uid());
--
--   "Students can manage own conversation turns"
--     ON design_conversation_turns FOR ALL
--     USING (conversation_id IN (
--       SELECT id FROM design_conversations WHERE student_id = auth.uid()
--     ))
--     WITH CHECK (conversation_id IN (
--       SELECT id FROM design_conversations WHERE student_id = auth.uid()
--     ));
--
-- Same bug class as competency_assessments (mig 20260429130731) and
-- quest_journeys (mig 20260429130732): `student_id` is `students.id`,
-- `auth.uid()` is `auth.users.id`. They are different UUIDs. The
-- comparison `student_id = auth.uid()` always returns false post-Phase-1.
--
-- ───────────────────────────────────────────────────────────────────────────
-- FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- Replace both policies with the auth.uid() → students.user_id → students.id
-- chain.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - 2 broken policies replaced with corrected versions
-- - "Teachers can read student conversations" + similar policies untouched
-- - No data change

DROP POLICY IF EXISTS "Students can manage own conversations" ON design_conversations;
DROP POLICY IF EXISTS "Students can manage own conversation turns" ON design_conversation_turns;

CREATE POLICY "Students can manage own conversations"
  ON design_conversations
  FOR ALL
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Students can manage own conversation turns"
  ON design_conversation_turns
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM design_conversations
      WHERE student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM design_conversations
      WHERE student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "Students can manage own conversations" ON design_conversations IS
  'Phase 1.5 — Rewritten from broken (student_id = auth.uid()) to use the auth.uid() → students.user_id → students.id chain. The original assumed students.id == auth.users.id which was never true.';
