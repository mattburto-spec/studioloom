-- Rollback for: tfl2_b4_trigger_inserts_on_student_latest
-- Pairs with: 20260511094231_tfl2_b4_trigger_inserts_on_student_latest.sql
-- Phase: TFL.2 Pass B sub-phase B.4
--
-- WHY ROLLBACK MAY BE NEEDED:
--   If the new INSERT-on-student-latest behavior produces unexpected
--   side effects (e.g. duplicate teacher turns from concurrent saves,
--   or some marking-page edit path we missed), restore the B.1 body
--   that always UPDATEs the latest teacher turn.
--
--   Data side effects: forward + reverse migrations only affect
--   FUTURE writes via the trigger. Existing tile_feedback_turns
--   rows + the column denormalization remain consistent either way.
--   The only thing that changes is what the NEXT save does.
--
-- CONTRACT: this rollback replays the B.1 trigger body verbatim,
-- preserving SECURITY DEFINER + search_path lockdown + EXECUTE
-- revokes. The CREATE OR REPLACE overwrites the B.4 version cleanly.

CREATE OR REPLACE FUNCTION sync_tile_feedback_from_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  latest_teacher_turn_id UUID;
BEGIN
  -- Skip if the column didn't actually change.
  IF (TG_OP = 'UPDATE') AND
     NEW.student_facing_comment IS NOT DISTINCT FROM OLD.student_facing_comment THEN
    RETURN NEW;
  END IF;

  -- Skip if the new value is null/empty (no comment to sync).
  IF NEW.student_facing_comment IS NULL OR NEW.student_facing_comment = '' THEN
    RETURN NEW;
  END IF;

  -- Find the latest teacher turn for this grade row, if any.
  SELECT id INTO latest_teacher_turn_id
  FROM tile_feedback_turns
  WHERE grade_id = NEW.id AND role = 'teacher'
  ORDER BY sent_at DESC
  LIMIT 1;

  IF latest_teacher_turn_id IS NULL THEN
    -- No prior turns — INSERT a new teacher turn.
    INSERT INTO tile_feedback_turns (grade_id, role, author_id, body_html, sent_at)
    VALUES (
      NEW.id,
      'teacher',
      COALESCE(NEW.graded_by, NEW.teacher_id),
      '<p>' || NEW.student_facing_comment || '</p>',
      now()
    );
  ELSE
    -- Existing turn — UPDATE it (B.1 behavior).
    UPDATE tile_feedback_turns
    SET
      body_html = '<p>' || NEW.student_facing_comment || '</p>',
      edited_at = now()
    WHERE id = latest_teacher_turn_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_tile_feedback_from_comment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sync_tile_feedback_from_comment() FROM anon;
REVOKE EXECUTE ON FUNCTION sync_tile_feedback_from_comment() FROM authenticated;

COMMENT ON FUNCTION sync_tile_feedback_from_comment() IS
  'TFL.2 Pass B sync trigger (B.1 body restored by B.4 rollback). When student_tile_grades.student_facing_comment changes, INSERT a new teacher turn if none exists, otherwise UPDATE the latest teacher turn body + bump edited_at. SECURITY DEFINER + search_path locked per Lesson #66.';
