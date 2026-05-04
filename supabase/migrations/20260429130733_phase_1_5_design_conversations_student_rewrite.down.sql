-- Rollback for: phase_1_5_design_conversations_student_rewrite
-- Pairs with: 20260429130733_phase_1_5_design_conversations_student_rewrite.sql
--
-- Restores the original (broken) policy shapes from migration 022.

DROP POLICY IF EXISTS "Students can manage own conversations" ON design_conversations;
DROP POLICY IF EXISTS "Students can manage own conversation turns" ON design_conversation_turns;

CREATE POLICY "Students can manage own conversations"
  ON design_conversations
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can manage own conversation turns"
  ON design_conversation_turns
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM design_conversations WHERE student_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM design_conversations WHERE student_id = auth.uid()
    )
  );
