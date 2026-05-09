-- Rollback for: add_bump_student_seen_comment_at_rpc
-- Pairs with: 20260509222601_add_bump_student_seen_comment_at_rpc.sql
--
-- WHY ROLLBACK MAY BE NEEDED:
--   The .up.sql adds a SECURITY DEFINER function that the
--   GET /api/student/tile-comments route calls via .rpc(). If the
--   function is removed, callers will receive PGRST202 ("function not
--   found"). Pair this rollback with a route revert that switches back
--   to the inline UPDATE pattern (which has the JS-vs-DB clock skew bug
--   the .up.sql was written to fix — accept that regression knowingly
--   when rolling back).
--
-- IDEMPOTENCY: DROP FUNCTION ... IF EXISTS — safe to re-run.

DROP FUNCTION IF EXISTS bump_student_seen_comment_at(UUID, UUID, TEXT);
