-- Phase 1.4 CS-3 hotfix — units student-side read policy for assigned units
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-14-client-switch-brief.md
-- Date: 30 April 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE BUG (surfaced via Phase 1.4 CS-3 prod smoke)
-- ───────────────────────────────────────────────────────────────────────────
--
-- After CS-3 switched 4 routes (grades, units, safety/pending, insights)
-- to SSR client, the `units` table queries returned 0 rows even when
-- test2 was demonstrably enrolled in classes that had units assigned:
--
--   - /api/student/grades         → unitTitle: ""  (empty)
--   - /api/student/units          → units: []     (empty array)
--   - /api/student/safety/pending → unit_title: "Unknown unit"
--
-- Cause: the `units` table has only one read policy —
--   "Teachers read own or published units" USING
--     ((author_teacher_id = auth.uid()) OR (teacher_id = auth.uid())
--      OR (is_published = true))
--
-- Students can only see units where is_published = true. Unpublished
-- units assigned to their classes (test data, in-progress drafts,
-- private school content) are blocked by RLS. Worked under admin client
-- (RLS bypass); breaks under SSR client.
--
-- Same shape as CS-1's audit findings (missing classes + assessment_records
-- student policies). Missed in Phase 1.5/1.5b + CS-1 because `units` is
-- conceptually a "content" table not a "student-data" table — but
-- students need to read its title/description for any unit they're
-- working through.
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- Additive student-side SELECT policy: a student can read a unit iff it
-- is assigned to one of their active class enrollments via class_units.
-- Canonical chain — auth.uid() → students.user_id → class_students →
-- class_units → units.
--
-- Recursion check: this policy traverses class_units → class_students →
-- students. None of those tables have a policy that subqueries `units`,
-- so no cycle. Verified against the comprehensive audit completed
-- earlier today (FU-AV2-RLS-SECURITY-DEFINER-AUDIT ✅ RESOLVED).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SELECT-only policy on `units` table
-- - Existing "Teachers read own or published units" + "Authors update/
--   delete own units" + "Teachers insert units" policies UNAFFECTED
-- - Students gain read access ONLY to units assigned to their active
--   class enrollments — not to all units, not to drafts in other
--   teachers' workshops, not to other schools' content
-- - INSERT/UPDATE/DELETE remain teacher-only (existing policies)
-- - No data change

CREATE POLICY "Students read own assigned units"
  ON units
  FOR SELECT
  USING (
    id IN (
      SELECT cu.unit_id
      FROM class_units cu
      WHERE cu.class_id IN (
        SELECT cs.class_id
        FROM class_students cs
        WHERE cs.student_id IN (
          SELECT id FROM students WHERE user_id = auth.uid()
        )
      )
    )
  );

COMMENT ON POLICY "Students read own assigned units" ON units IS
  'Phase 1.4 CS-3 — Students authenticated via Supabase Auth can SELECT units assigned to their active class enrollments via the class_units junction. Canonical chain auth.uid() → students.user_id → class_students → class_units. No cycle (audited 30 Apr 2026). INSERT/UPDATE/DELETE remain teacher-only.';
