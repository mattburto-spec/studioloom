-- Rollback for: student_badges_column_type_uuid_with_fk
-- Pairs with: 20260430042051_student_badges_column_type_uuid_with_fk.sql
--
-- Reverts column type back to TEXT, drops the FK, restores the
-- original ::text-cast policies. WARNING: Phase 1.4 CS-1's
-- student_badges_rewrite migration assumed TEXT column with `::text`
-- cast on RHS. Reverting this rollback restores compatibility with
-- the prior CS-1 policy shape. Use only if the cleanup introduces a
-- regression — not for casual rollback.

-- Drop the cleaned policies
DROP POLICY IF EXISTS student_badges_read_own ON student_badges;
DROP POLICY IF EXISTS student_badges_teacher_read ON student_badges;
DROP POLICY IF EXISTS student_badges_teacher_insert ON student_badges;

-- Drop the FK
ALTER TABLE student_badges
  DROP CONSTRAINT IF EXISTS student_badges_student_id_fkey;

-- Revert column type
ALTER TABLE student_badges
  ALTER COLUMN student_id TYPE TEXT USING student_id::text;

-- Restore the original CS-1-era policies (with ::text casts)
CREATE POLICY student_badges_read_own ON student_badges
  FOR SELECT
  USING (
    student_id IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY student_badges_teacher_read ON student_badges
  FOR SELECT USING (
    student_id::text IN (
      SELECT s.id::text FROM students s
      WHERE s.class_id::text IN (SELECT c.id::text FROM classes c WHERE c.teacher_id::text = auth.uid()::text)
    )
  );

CREATE POLICY student_badges_teacher_insert ON student_badges
  FOR INSERT WITH CHECK (
    student_id::text IN (
      SELECT s.id::text FROM students s
      WHERE s.class_id::text IN (SELECT c.id::text FROM classes c WHERE c.teacher_id::text = auth.uid()::text)
    )
  );
