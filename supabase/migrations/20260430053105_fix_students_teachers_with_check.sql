-- Hotfix — students "Teachers manage students" WITH CHECK breaks INSERT
--
-- Project: Access Model v2 (post-Phase-1.4 hygiene)
-- Date: 30 April 2026 (late) — surfaced via FU-AV2-UI-STUDENT-INSERT-REFACTOR smoke
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE BUG
-- ───────────────────────────────────────────────────────────────────────────
--
-- CS-2's first SECURITY DEFINER hotfix (20260430010922) replaced the
-- original `Teachers manage students` policy with one that uses
-- `is_teacher_of_student(id)` for both USING and WITH CHECK.
--
--   USING (public.is_teacher_of_student(id))
--   WITH CHECK (public.is_teacher_of_student(id))
--
-- The function does:
--   SELECT EXISTS (SELECT 1 FROM students s WHERE s.id = student_uuid AND ...)
--
-- For SELECT/UPDATE/DELETE the existing row is in the table — function
-- finds it, evaluates the OR conditions, returns true. ✓
--
-- For INSERT the new row is NOT in the table when WITH CHECK fires.
-- Postgres evaluates WITH CHECK BEFORE the row is committed to heap.
-- The function's `SELECT FROM students WHERE id = NEW.id` returns 0
-- rows → EXISTS returns false → WITH CHECK fails → INSERT rejected
-- with "new row violates row-level security policy".
--
-- This was invisible to the route layer because admin client
-- (createAdminClient) bypasses RLS entirely. It surfaced today during
-- prod smoke of the FU-AV2-UI-STUDENT-INSERT-REFACTOR migration —
-- the BROWSER (anon-key + teacher cookie) hit RLS and 403'd.
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE FIX — split FOR ALL into discrete cmd policies
-- ───────────────────────────────────────────────────────────────────────────
--
-- DROP "Teachers manage students" (FOR ALL).
-- CREATE 4 separate policies:
--   - FOR SELECT: USING (is_teacher_of_student(id))    — existing-row check
--   - FOR UPDATE: USING + WITH CHECK same — both clauses see the existing row
--   - FOR DELETE: USING (is_teacher_of_student(id))    — existing-row check
--   - FOR INSERT: WITH CHECK (author_teacher_id = auth.uid())
--                 — direct check on the new row's column. No recursion
--                 concern because we're not subquerying class_students for
--                 INSERT — a new student can't have any class_students row
--                 yet. The teacher creating them sets author_teacher_id.
--
-- Why this is recursion-safe: the new INSERT policy uses only direct
-- column comparison (`author_teacher_id = auth.uid()`), no subquery into
-- another RLS-protected table. The other 3 policies use the SECURITY
-- DEFINER helper that already breaks the cycle.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - DROP "Teachers manage students" (the FOR ALL policy)
-- - CREATE "Teachers SELECT students"
-- - CREATE "Teachers UPDATE students"
-- - CREATE "Teachers DELETE students"
-- - CREATE "Teachers INSERT students"
-- - Net semantic preserved: teachers can S/U/D students they have access
--   to (via legacy class_id, author_teacher_id, or class_students junction)
--   AND can INSERT students they author themselves.
-- - No data change.

DROP POLICY "Teachers manage students" ON students;

CREATE POLICY "Teachers SELECT students"
  ON students
  FOR SELECT
  USING (public.is_teacher_of_student(id));

CREATE POLICY "Teachers UPDATE students"
  ON students
  FOR UPDATE
  USING (public.is_teacher_of_student(id))
  WITH CHECK (public.is_teacher_of_student(id));

CREATE POLICY "Teachers DELETE students"
  ON students
  FOR DELETE
  USING (public.is_teacher_of_student(id));

CREATE POLICY "Teachers INSERT students"
  ON students
  FOR INSERT
  WITH CHECK (author_teacher_id = auth.uid());

COMMENT ON POLICY "Teachers SELECT students" ON students IS
  'Hotfix 30 Apr 2026 PM — split from "Teachers manage students" FOR ALL. SELECT path uses SECURITY DEFINER helper for recursion-safe access checks.';

COMMENT ON POLICY "Teachers UPDATE students" ON students IS
  'Hotfix 30 Apr 2026 PM — UPDATE path. Both USING and WITH CHECK use is_teacher_of_student(id) — for UPDATE the existing row is in scope so the helpers SELECT finds it.';

COMMENT ON POLICY "Teachers DELETE students" ON students IS
  'Hotfix 30 Apr 2026 PM — DELETE path. Same as SELECT.';

COMMENT ON POLICY "Teachers INSERT students" ON students IS
  'Hotfix 30 Apr 2026 PM — INSERT path uses direct column check (author_teacher_id = auth.uid()) instead of is_teacher_of_student(id), because the new row is not yet in students for the SECURITY DEFINER function to find. No recursion risk because the policy does not subquery any RLS-protected table.';
