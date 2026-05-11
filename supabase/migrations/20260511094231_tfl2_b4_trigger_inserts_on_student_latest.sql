-- Migration: tfl2_b4_trigger_inserts_on_student_latest
-- Created: 20260511094231 UTC
-- Phase: TFL.2 Pass B sub-phase B.4
--
-- WHY: B.1's sync_tile_feedback_from_comment() trigger always
--   UPDATEs the latest teacher turn when student_facing_comment
--   changes after the first save — the assumption was "marking page
--   composer = single textarea = always editing the same comment".
--   That assumption holds PRE-reply.
--
--   With B.3 shipped, students now reply. The teacher loop only
--   closes if their NEXT save becomes a follow-up TURN, not an edit
--   of the original. Currently a teacher save after a student
--   reply overwrites the original comment instead of appending.
--
--   Fix: when the latest turn for a grade is a STUDENT turn, the
--   trigger INSERTs a new teacher turn rather than UPDATEing the
--   latest teacher turn. When the latest turn is a TEACHER turn,
--   continue UPDATEing in place (so teacher can edit their last
--   message before the student has seen / replied to it).
--
--   Transition table:
--     null → non-null (no prior turn)                  = INSERT (unchanged)
--     non-null → diff. (latest turn = teacher)         = UPDATE  (unchanged)
--     non-null → diff. (latest turn = student)         = INSERT  (NEW)
--     non-null → null                                  = no-op   (unchanged)
--     same → same                                      = no-op   (unchanged)
--
-- IMPACT:
--   - Function body of sync_tile_feedback_from_comment() rewritten.
--   - Trigger trg_sync_tile_feedback_from_comment unchanged (same
--     name, same firing condition, same function reference).
--   - student_facing_comment column unchanged — still the
--     denormalized cache of the latest TEACHER turn body.
--   - tile_feedback_turns rows + the existing 2 backfilled teacher
--     turns untouched.
--   - SECURITY DEFINER + search_path lockdown preserved (Lesson #66).
--   - EXECUTE revokes from PUBLIC/anon/authenticated preserved
--     (Lesson #52).
--
-- ROLLBACK: paired .down.sql replays the B.1 trigger body verbatim,
--   restoring the always-UPDATE-the-latest-teacher-turn behavior.
--   No data corruption either direction — the new behavior only
--   affects future writes; existing turns remain.

CREATE OR REPLACE FUNCTION sync_tile_feedback_from_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public  -- Lesson #66
AS $$
DECLARE
  latest_turn_id   UUID;
  latest_turn_role TEXT;
BEGIN
  -- Skip if the column didn't actually change.
  IF (TG_OP = 'UPDATE') AND
     NEW.student_facing_comment IS NOT DISTINCT FROM OLD.student_facing_comment THEN
    RETURN NEW;
  END IF;

  -- Skip if the new value is null/empty. On INSERT this is the
  -- typical path (rows are created before any comment is written).
  -- On UPDATE (non-null → null), preserve thread history — the
  -- chip dot reflects the missing comment via the existing
  -- student_facing_comment-is-null path.
  IF NEW.student_facing_comment IS NULL OR NEW.student_facing_comment = '' THEN
    RETURN NEW;
  END IF;

  -- Inspect the LATEST turn (regardless of role) for this grade.
  -- The role determines whether to INSERT or UPDATE:
  --   no turns yet         → INSERT  (first teacher comment)
  --   latest is teacher    → UPDATE  (editing in place)
  --   latest is student    → INSERT  (teacher follow-up after reply)
  SELECT id, role INTO latest_turn_id, latest_turn_role
  FROM tile_feedback_turns
  WHERE grade_id = NEW.id
  ORDER BY sent_at DESC
  LIMIT 1;

  IF latest_turn_id IS NULL OR latest_turn_role = 'student' THEN
    -- No prior turns OR latest is a student reply → INSERT new
    -- teacher turn. The B.4 semantic upgrade.
    INSERT INTO tile_feedback_turns (grade_id, role, author_id, body_html, sent_at)
    VALUES (
      NEW.id,
      'teacher',
      COALESCE(NEW.graded_by, NEW.teacher_id),
      '<p>' || NEW.student_facing_comment || '</p>',
      now()
    );
  ELSE
    -- Latest is a teacher turn → UPDATE it in place. Editing the
    -- last teacher message before the student has replied is
    -- still allowed; bump edited_at so the chip tooltip can
    -- surface "(edited)" if the student has already seen the
    -- previous version.
    UPDATE tile_feedback_turns
    SET
      body_html = '<p>' || NEW.student_facing_comment || '</p>',
      edited_at = now()
    WHERE id = latest_turn_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_tile_feedback_from_comment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sync_tile_feedback_from_comment() FROM anon;
REVOKE EXECUTE ON FUNCTION sync_tile_feedback_from_comment() FROM authenticated;

COMMENT ON FUNCTION sync_tile_feedback_from_comment() IS
  'TFL.2 Pass B sync trigger. B.4 (11 May 2026): now INSERTs a new teacher turn when the LATEST turn is a student reply, so the teacher loop closes — teacher comments after student replies become follow-up turns instead of overwriting the original. Pre-reply: still UPDATEs the latest teacher turn (editing in place). SECURITY DEFINER + search_path locked per Lesson #66.';
