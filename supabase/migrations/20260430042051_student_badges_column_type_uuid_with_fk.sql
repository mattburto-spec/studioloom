-- Cleanup — student_badges.student_id: TEXT → UUID + add FK + drop ::text casts
--
-- Project: Access Model v2 (post-Phase-1.4 hygiene)
-- Closes: FU-AV2-STUDENT-BADGES-COLUMN-TYPE (P3)
-- Surfaced: 30 April 2026 — Phase 1.4 CS-1 prod apply hit a `text = uuid`
-- error when CS-1's student_badges_rewrite migration tried to compare
-- student_badges.student_id (TEXT) with students.id (UUID).
-- Date: 30 April 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- BACKGROUND
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 035 (safety_badges) created `student_badges.student_id` as
-- TEXT NOT NULL with the comment "nanoid from student_sessions" — meant
-- to hold legacy custom-token nanoids. In practice production stores
-- text-formatted UUIDs (the column never actually held nanoids; the
-- comment was speculative). All 3 policies on student_badges used
-- `::text` casts on both sides to make the comparison work.
--
-- Phase 1.4 CS-1 carried that cast forward in the rewritten
-- student_badges_read_own policy as a workaround. The proper cleanup
-- (this migration) makes the column UUID, adds the missing FK to
-- students(id), and drops the casts in all 3 policies.
--
-- ───────────────────────────────────────────────────────────────────────────
-- PRE-FLIGHT (verified 30 Apr 2026 PM before applying)
-- ───────────────────────────────────────────────────────────────────────────
--
-- 1. SELECT student_id FROM student_badges
--    WHERE student_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--    → 0 rows (every value is UUID-formatted)
--
-- 2. SELECT sb.student_id FROM student_badges sb
--    LEFT JOIN students s ON s.id::text = sb.student_id
--    WHERE s.id IS NULL;
--    → 0 rows (no orphans)
--
-- 3. SELECT COUNT(*) FROM student_badges; → 4 rows total (small table)
--
-- Migration is safe: ALTER COLUMN TYPE will succeed with USING student_id::uuid;
-- ADD CONSTRAINT FOREIGN KEY won't reject because no orphans.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - student_badges.student_id: TEXT NOT NULL → UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE
-- - 3 policies DROP+CREATE without ::text casts (semantic preserved):
--     * student_badges_read_own (CS-1 canonical chain — drops `id::text` cast)
--     * student_badges_teacher_read (drops 6 `::text` casts; same logic)
--     * student_badges_teacher_insert (drops 6 `::text` casts; same logic)
-- - No data change (data already UUID-shaped).
-- - Code callers unchanged — postgres-js + supabase-js auto-coerce string
--   UUIDs at the wire format, so all `eq("student_id", studentIdString)`
--   calls keep working.

-- ─── 1. Drop policies that reference the column (must drop before ALTER) ───

DROP POLICY IF EXISTS student_badges_read_own ON student_badges;
DROP POLICY IF EXISTS student_badges_teacher_read ON student_badges;
DROP POLICY IF EXISTS student_badges_teacher_insert ON student_badges;

-- ─── 2. ALTER COLUMN type + add FK ────────────────────────────────────────

ALTER TABLE student_badges
  ALTER COLUMN student_id TYPE UUID USING student_id::uuid;

ALTER TABLE student_badges
  ADD CONSTRAINT student_badges_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- ─── 3. Recreate the 3 policies without ::text casts ──────────────────────

-- Student self-read (canonical Phase-1 chain, cleaned)
CREATE POLICY student_badges_read_own ON student_badges
  FOR SELECT
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Teacher read for class members (legacy class_id chain — same as before, just cleaner)
CREATE POLICY student_badges_teacher_read ON student_badges
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.class_id IN (SELECT c.id FROM classes c WHERE c.teacher_id = auth.uid())
    )
  );

-- Teacher insert badges for their class members (same legacy chain)
CREATE POLICY student_badges_teacher_insert ON student_badges
  FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.class_id IN (SELECT c.id FROM classes c WHERE c.teacher_id = auth.uid())
    )
  );

COMMENT ON POLICY student_badges_read_own ON student_badges IS
  'Cleaned 30 Apr 2026 — Students self-read via canonical Phase-1 chain (auth.uid() → students.user_id → students.id). No ::text cast — student_id is UUID natively post column-type cleanup.';

COMMENT ON POLICY student_badges_teacher_read ON student_badges IS
  'Cleaned 30 Apr 2026 — Teachers read badges of students in classes they own. Uses legacy students.class_id chain (matches original migration 035 logic). No ::text casts.';

COMMENT ON POLICY student_badges_teacher_insert ON student_badges IS
  'Cleaned 30 Apr 2026 — Teachers can award badges to students in classes they own. Same chain as teacher_read.';
