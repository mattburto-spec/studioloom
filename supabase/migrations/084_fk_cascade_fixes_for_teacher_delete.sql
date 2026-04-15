-- Migration 084 — ON DELETE cascade / SET NULL across teacher FKs
--
-- When `/api/admin/teachers/[id]` calls `supabase.auth.admin.deleteUser()`,
-- PostgreSQL walks every FK pointing at auth.users(id) or teachers(id) and
-- aborts with "Database error deleting user" if any constraint omits an
-- `ON DELETE` clause (defaults to `NO ACTION` = block).
--
-- The admin DELETE endpoint already blocks deletion when the teacher owns
-- classes or units, so CASCADE on content-ownership columns is safe — it
-- only fires for teachers the admin UI already deemed "safe to remove".
-- For audit-trail columns (resolved_by, overridden_by, author_teacher_id on
-- students) SET NULL is correct: the trail should outlive the actor, and
-- students belong to their class, not to whoever invited them.
--
-- Policy per column:
--   CASCADE  — content the teacher created goes with them
--   SET NULL — audit / reference pointers that should persist
--
-- Fix applied 15 Apr 2026 after migrating `teachers@questerra.org` in
-- staging failed with a FK block.

-- Helper: drop + re-add an FK with the desired ON DELETE clause.
-- Uses DO blocks so a missing constraint (e.g. already-patched env) is a
-- warning rather than an error.

DO $$
BEGIN
  -- 1. students.author_teacher_id → SET NULL
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_author_teacher_id_fkey') THEN
    ALTER TABLE students DROP CONSTRAINT students_author_teacher_id_fkey;
  END IF;
  ALTER TABLE students
    ADD CONSTRAINT students_author_teacher_id_fkey
    FOREIGN KEY (author_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

  -- 2. units.author_teacher_id → CASCADE (migration 007 column)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_author_teacher_id_fkey') THEN
    ALTER TABLE units DROP CONSTRAINT units_author_teacher_id_fkey;
  END IF;
  ALTER TABLE units
    ADD CONSTRAINT units_author_teacher_id_fkey
    FOREIGN KEY (author_teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- 3. units.teacher_id → CASCADE (migration 023 column)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_teacher_id_fkey') THEN
    ALTER TABLE units DROP CONSTRAINT units_teacher_id_fkey;
  END IF;
  ALTER TABLE units
    ADD CONSTRAINT units_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- 4. content_moderation_log.overridden_by → SET NULL (audit trail)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_moderation_log_overridden_by_fkey') THEN
    ALTER TABLE content_moderation_log DROP CONSTRAINT content_moderation_log_overridden_by_fkey;
  END IF;
  ALTER TABLE content_moderation_log
    ADD CONSTRAINT content_moderation_log_overridden_by_fkey
    FOREIGN KEY (overridden_by) REFERENCES teachers(id) ON DELETE SET NULL;

  -- 5. content_items.teacher_id → CASCADE
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_items_teacher_id_fkey') THEN
    ALTER TABLE content_items DROP CONSTRAINT content_items_teacher_id_fkey;
  END IF;
  ALTER TABLE content_items
    ADD CONSTRAINT content_items_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- 6. activity_blocks.teacher_id → CASCADE
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_blocks_teacher_id_fkey') THEN
    ALTER TABLE activity_blocks DROP CONSTRAINT activity_blocks_teacher_id_fkey;
  END IF;
  ALTER TABLE activity_blocks
    ADD CONSTRAINT activity_blocks_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- 7. generation_runs.teacher_id → CASCADE
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'generation_runs_teacher_id_fkey') THEN
    ALTER TABLE generation_runs DROP CONSTRAINT generation_runs_teacher_id_fkey;
  END IF;
  ALTER TABLE generation_runs
    ADD CONSTRAINT generation_runs_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- 8. gallery_rounds.teacher_id → CASCADE
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_rounds_teacher_id_fkey') THEN
    ALTER TABLE gallery_rounds DROP CONSTRAINT gallery_rounds_teacher_id_fkey;
  END IF;
  ALTER TABLE gallery_rounds
    ADD CONSTRAINT gallery_rounds_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- 9. feedback_proposals.resolved_by → SET NULL (audit trail)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_proposals_resolved_by_fkey') THEN
    ALTER TABLE feedback_proposals DROP CONSTRAINT feedback_proposals_resolved_by_fkey;
  END IF;
  ALTER TABLE feedback_proposals
    ADD CONSTRAINT feedback_proposals_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- 10. feedback_audit_log.resolved_by → SET NULL (audit trail)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_audit_log_resolved_by_fkey') THEN
    ALTER TABLE feedback_audit_log DROP CONSTRAINT feedback_audit_log_resolved_by_fkey;
  END IF;
  ALTER TABLE feedback_audit_log
    ADD CONSTRAINT feedback_audit_log_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
END$$;

-- Post-migration sanity check. If any of the 10 FKs still shows NO ACTION,
-- something got skipped and admin teacher-delete will still fail.
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.contype = 'f'
    AND c.confdeltype = 'a'  -- 'a' = NO ACTION
    AND (
      (t.relname = 'students' AND a.attname = 'author_teacher_id') OR
      (t.relname = 'units' AND a.attname IN ('author_teacher_id', 'teacher_id')) OR
      (t.relname = 'content_moderation_log' AND a.attname = 'overridden_by') OR
      (t.relname = 'content_items' AND a.attname = 'teacher_id') OR
      (t.relname = 'activity_blocks' AND a.attname = 'teacher_id') OR
      (t.relname = 'generation_runs' AND a.attname = 'teacher_id') OR
      (t.relname = 'gallery_rounds' AND a.attname = 'teacher_id') OR
      (t.relname = 'feedback_proposals' AND a.attname = 'resolved_by') OR
      (t.relname = 'feedback_audit_log' AND a.attname = 'resolved_by')
    );
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Migration 084 left % FK(s) still on NO ACTION', bad_count;
  END IF;
END$$;
