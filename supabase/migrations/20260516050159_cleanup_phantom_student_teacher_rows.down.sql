-- Rollback for: cleanup_phantom_student_teacher_rows
-- Pairs with: 20260516050159_cleanup_phantom_student_teacher_rows.sql
--
-- DOCUMENTED NO-OP.
--
-- The forward migration deletes ≤53 pure-orphan teacher rows (no FK
-- references, no real-world semantics). They were trigger-bug fall-through
-- artefacts. Reconstructing them would require:
--   1. Pulling auth.users.id values + emails for student-shape auth users
--   2. INSERTing back into public.teachers with those ids
--   3. Manufacturing names from email split_part
--
-- Even if reconstructed, the rows would still be garbage — they'd just
-- restore the original problem state. The forward migration is the
-- correct end state. Roll back the trigger fix (the .down for
-- 20260516044909) instead if a regression to the 11 May behaviour is
-- genuinely needed.
--
-- This file exists so the migrations directory has the symmetric
-- .sql + .down.sql pair the tooling expects.

DO $$
BEGIN
  RAISE NOTICE 'cleanup_phantom_student_teacher_rows DOWN is a no-op — see header comment.';
END $$;
