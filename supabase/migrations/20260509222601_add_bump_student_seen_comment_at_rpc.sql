-- Migration: add_bump_student_seen_comment_at_rpc
-- Created: 20260509222601 UTC
--
-- WHY: TFL.1 hotfix. The original TFL.1.2 implementation generated the
--   seen-receipt timestamp in Node (`new Date().toISOString()`) before
--   the request reached Postgres. The student_tile_grades BEFORE-UPDATE
--   trigger then set `updated_at = now()` from Postgres time. Result:
--   `student_seen_comment_at` lands ~100–200ms BEFORE `updated_at` on
--   the same UPDATE — so even when nothing was edited, the chip's
--   `seen >= updated_at` check returns false and the tooltip says
--   "Seen the older version" on a fresh receipt.
--
--   Fix: do the bump via a SQL function so both `student_seen_comment_at`
--   and `updated_at` derive from the same `now()` (transaction-start
--   time, identical across SET clause + trigger fire). The route then
--   calls `.rpc('bump_student_seen_comment_at', {...})` instead of an
--   inline UPDATE.
--
-- IMPACT:
--   - NEW FUNCTION: bump_student_seen_comment_at(p_student_id UUID,
--                   p_unit_id UUID, p_page_id TEXT) RETURNS void.
--     SECURITY DEFINER so the route's service-role client can call it.
--     EXECUTE granted to service_role; not granted to anon/authenticated
--     so the function can never be called by an unauthenticated client
--     (defence in depth — the route already gates via
--     requireStudentSession before calling).
--   - search_path locked to pg_catalog, public per Lesson #66.
--   - No table changes, no RLS changes.
--
-- ROLLBACK: paired .down.sql drops the function. The route reverts to
--   inline UPDATE (the bug) — keep the rollback paired with a route
--   revert if rolling back.

CREATE OR REPLACE FUNCTION bump_student_seen_comment_at(
  p_student_id UUID,
  p_unit_id    UUID,
  p_page_id    TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE student_tile_grades
    SET student_seen_comment_at = now()
  WHERE student_id = p_student_id
    AND unit_id    = p_unit_id
    AND page_id    = p_page_id
    AND student_facing_comment IS NOT NULL
    AND student_facing_comment <> '';
END;
$$;

REVOKE EXECUTE ON FUNCTION bump_student_seen_comment_at(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION bump_student_seen_comment_at(UUID, UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION bump_student_seen_comment_at(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION bump_student_seen_comment_at(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION bump_student_seen_comment_at(UUID, UUID, TEXT) IS
  'TFL.1 read-receipt bump. Both student_seen_comment_at and the trigger-managed updated_at derive from the same now() (transaction start), so seen_at >= updated_at on a fresh receipt — fixes the JS-vs-DB clock-skew bug where seen_at landed ~100ms before updated_at and produced spurious "seen the older version" tooltips. Called by GET /api/student/tile-comments via service-role .rpc().';
