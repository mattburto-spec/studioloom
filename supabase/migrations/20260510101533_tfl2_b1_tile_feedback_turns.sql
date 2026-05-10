-- Migration: tfl2_b1_tile_feedback_turns
-- Created: 20260510101533 UTC
-- Phase: TFL.2 Pass B sub-phase B.1
--
-- WHY: Pass A shipped <TeacherFeedback /> with a multi-turn thread
--   API (Turn = TeacherTurn | StudentTurn) running on fixtures.
--   Pass B's first move is the persistence layer: one row per turn
--   in a new tile_feedback_turns table, backfilled from the existing
--   single-column student_tile_grades.student_facing_comment.
--
--   The existing column stays as a denormalized cache of the latest
--   teacher turn body — 6 production readers depend on it (route
--   handlers + chip + bell + comment-status helper + write path).
--   A sync trigger keeps the column and the new table consistent
--   going forward: any teacher save via the existing marking-page
--   pattern flows through the column AND into the turns table.
--
--   Per-turn read receipts are explicitly OUT of scope for v1 — the
--   TFL.1 student_seen_comment_at column tracks "latest seen" for
--   the whole grade row, which is enough to drive the chip dot
--   ladder. Per-turn tracking can land later if a use case emerges.
--
-- IMPACT:
--   - NEW TABLE: tile_feedback_turns (id, grade_id FK, role,
--     author_id, body_html, edited_at, sentiment, reply_text,
--     sent_at). CHECK constraint enforces the discriminated-union
--     shape: a teacher row has author_id + body_html and no student
--     fields; a student row has sentiment and no teacher fields.
--   - NEW INDEX: idx_tile_feedback_turns_grade_sent on
--     (grade_id, sent_at) — the canonical access pattern is "all
--     turns for a grade, ordered by time".
--   - RLS enabled. Teachers SELECT via grade_id → student_tile_grades
--     → class_id → classes.teacher_id. Service-role bypasses RLS for
--     the route layer's writes. Students don't use Supabase Auth
--     (custom session tokens) — they always come through service-
--     role at the API boundary, so no student-side policy is needed.
--   - BACKFILL: one teacher turn per existing student_tile_grades
--     row with non-null + non-empty student_facing_comment. Body
--     wrapped in <p>...</p> (the column is plain text per the
--     marking composer). sent_at = COALESCE(updated_at, created_at).
--   - SYNC TRIGGER: AFTER INSERT/UPDATE on student_tile_grades.
--     null → non-null = INSERT new teacher turn.
--     non-null → different non-null = UPDATE latest teacher turn's
--       body_html + bump edited_at.
--     Other transitions = no-op.
--
--   - Does NOT drop student_facing_comment. Pass B sub-phases
--     B.2–B.4 migrate the 6 readers gradually; the column gets
--     dropped (if ever) only after the last reader is gone.
--
-- ROLLBACK: paired .down.sql drops the trigger, the function, and
--   the table. Existing student_facing_comment data is untouched.

-- ════════════════════════════════════════════════════════════════════
-- 1. Table
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tile_feedback_turns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id    UUID NOT NULL REFERENCES student_tile_grades(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('teacher', 'student')),

  -- Teacher-only fields. NULL when role='student'.
  author_id   UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  body_html   TEXT NULL,
  edited_at   TIMESTAMPTZ NULL,

  -- Student-only fields. NULL when role='teacher'.
  sentiment   TEXT NULL CHECK (sentiment IN ('got_it', 'not_sure', 'pushback')),
  reply_text  TEXT NULL,

  -- Both.
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Discriminated-union integrity. Catches future writers mixing
  -- teacher + student fields on the same row.
  CONSTRAINT teacher_or_student CHECK (
    (role = 'teacher'
       AND author_id IS NOT NULL
       AND body_html IS NOT NULL
       AND sentiment IS NULL
       AND reply_text IS NULL)
    OR
    (role = 'student'
       AND sentiment IS NOT NULL
       AND author_id IS NULL
       AND body_html IS NULL
       AND edited_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tile_feedback_turns_grade_sent
  ON tile_feedback_turns(grade_id, sent_at);

COMMENT ON TABLE tile_feedback_turns IS
  'TFL.2 Pass B — multi-turn feedback thread. One row per turn (teacher comment OR student reply), ordered by sent_at. Replaces the single student_tile_grades.student_facing_comment column conceptually; the column stays as a denormalized cache of the latest teacher turn body kept in sync via the sync_tile_feedback_from_comment trigger.';

-- ════════════════════════════════════════════════════════════════════
-- 2. RLS — service-role full, teachers SELECT own classes only
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE tile_feedback_turns ENABLE ROW LEVEL SECURITY;

-- Service-role full access (the route layer always uses createAdminClient).
CREATE POLICY tfl2_service_role_full
  ON tile_feedback_turns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Teachers SELECT own classes via grade_id → student_tile_grades →
-- class_id → classes.teacher_id. INSERT/UPDATE/DELETE go through
-- service-role at the API boundary so no policies are granted to
-- authenticated for those.
CREATE POLICY tfl2_teacher_select_own_classes
  ON tile_feedback_turns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM student_tile_grades stg
      JOIN classes c ON c.id = stg.class_id
      WHERE stg.id = tile_feedback_turns.grade_id
        AND c.teacher_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 3. Backfill — one teacher turn per existing comment
-- ════════════════════════════════════════════════════════════════════

-- Wrap inline in <p>...</p>. The existing column is plain text per
-- the marking composer; HTML escaping is delegated to the route's
-- sanitizer when reads start going through the new component (B.2).
-- Until then, render-time consumers continue to read the plain
-- column — no data is "downgraded".
INSERT INTO tile_feedback_turns (grade_id, role, author_id, body_html, sent_at)
SELECT
  stg.id                                                    AS grade_id,
  'teacher'                                                 AS role,
  COALESCE(stg.graded_by, stg.teacher_id)                   AS author_id,
  '<p>' || stg.student_facing_comment || '</p>'             AS body_html,
  COALESCE(stg.updated_at, stg.created_at)                  AS sent_at
FROM student_tile_grades stg
WHERE stg.student_facing_comment IS NOT NULL
  AND stg.student_facing_comment <> '';

-- ════════════════════════════════════════════════════════════════════
-- 4. Sync trigger — keep tile_feedback_turns + student_facing_comment
--    column consistent for the existing marking-page write path
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_tile_feedback_from_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public  -- Lesson #66
AS $$
DECLARE
  latest_teacher_turn_id UUID;
BEGIN
  -- Skip if the column didn't actually change.
  IF (TG_OP = 'UPDATE') AND
     NEW.student_facing_comment IS NOT DISTINCT FROM OLD.student_facing_comment THEN
    RETURN NEW;
  END IF;

  -- Skip if the new value is null/empty (no comment to sync). On
  -- INSERT this is the typical path (rows are created before any
  -- comment is written). On UPDATE (non-null → null), preserve
  -- thread history; the chip dot will reflect the missing comment
  -- via the existing student_facing_comment-is-null path.
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
    -- Existing turn — UPDATE it. The marking-page composer in v1
    -- only ever produces a single teacher turn per grade row
    -- (single textarea pattern), so "latest teacher turn" is always
    -- the right target. B.4 will introduce a multi-turn composer
    -- that writes directly to tile_feedback_turns + bypasses this
    -- trigger's update path.
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
-- service_role is the only writer to student_tile_grades in
-- production code paths. Trigger functions execute as the row
-- owner regardless of caller role when SECURITY DEFINER is set.

COMMENT ON FUNCTION sync_tile_feedback_from_comment() IS
  'TFL.2 Pass B sync trigger. When student_tile_grades.student_facing_comment changes (null → non-null = INSERT teacher turn; non-null → different non-null = UPDATE latest teacher turn body + bump edited_at). Keeps the legacy column and the new tile_feedback_turns table consistent during the gradual reader migration in B.2–B.4. SECURITY DEFINER + search_path locked per Lesson #66.';

CREATE TRIGGER trg_sync_tile_feedback_from_comment
  AFTER INSERT OR UPDATE OF student_facing_comment ON student_tile_grades
  FOR EACH ROW
  EXECUTE FUNCTION sync_tile_feedback_from_comment();

COMMENT ON TRIGGER trg_sync_tile_feedback_from_comment ON student_tile_grades IS
  'TFL.2 Pass B — fires AFTER INSERT/UPDATE on student_facing_comment to keep tile_feedback_turns in sync with the legacy column. See sync_tile_feedback_from_comment() function comment for transition table.';
