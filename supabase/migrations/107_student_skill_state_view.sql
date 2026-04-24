-- =====================================================================
-- 107_student_skill_state_view.sql
-- Skills Library Phase S1 — derived current-state per student × skill
--
-- Aggregates learning_events (type 'skill.*') into the highest-reached
-- state per (student, skill) pair, with a freshness band. This is the
-- view the Skills page, lesson-embed gates, and Open Studio capability
-- queries read from.
--
-- State ladder (higher wins):
--   0  untouched       — no events logged
--   1  viewed          — student opened the card
--   2  quiz_passed     — answered quiz correctly (also: refresh_passed)
--                        and refresh_acknowledged (light-touch re-look)
--   3  demonstrated    — teacher marked the student as demonstrating
--   4  applied         — evidenced in a Stone / portfolio / project
--
-- Freshness bands (time since last ≥quiz_passed event):
--   fresh      0-90 days
--   cooling    91-180 days
--   stale      >180 days
--
-- View only returns rows for students who have AT LEAST one skill event.
-- Use LEFT JOIN from skill_cards if you need the untouched state (it's
-- simply "no row in this view").
-- =====================================================================

CREATE OR REPLACE VIEW student_skill_state AS
WITH ranked AS (
  SELECT
    student_id,
    subject_id AS skill_id,
    event_type,
    created_at,
    CASE event_type
      WHEN 'skill.viewed'                THEN 1
      WHEN 'skill.quiz_failed'           THEN 1  -- still just "viewed" level; failure is not a regression
      WHEN 'skill.refresh_acknowledged'  THEN 2
      WHEN 'skill.quiz_passed'           THEN 2
      WHEN 'skill.refresh_passed'        THEN 2
      WHEN 'skill.demonstrated'          THEN 3
      WHEN 'skill.applied'               THEN 4
      ELSE 0
    END AS state_rank
  FROM learning_events
  WHERE subject_type = 'skill_card'
    AND event_type LIKE 'skill.%'
),
agg AS (
  SELECT
    student_id,
    skill_id,
    MAX(state_rank) AS max_rank,
    -- Freshness anchors off the most recent event that moved state to >= 2
    -- (quiz_passed / refresh_passed). Views that only ever recorded
    -- skill.viewed have NULL freshness — they're "just seen, not learned".
    MAX(created_at) FILTER (WHERE state_rank >= 2) AS last_passed_at
  FROM ranked
  GROUP BY student_id, skill_id
)
SELECT
  student_id,
  skill_id,
  max_rank,
  CASE max_rank
    WHEN 4 THEN 'applied'
    WHEN 3 THEN 'demonstrated'
    WHEN 2 THEN 'quiz_passed'
    WHEN 1 THEN 'viewed'
    ELSE 'untouched'
  END AS state,
  last_passed_at,
  CASE
    WHEN last_passed_at IS NULL                             THEN NULL
    WHEN last_passed_at >  now() - interval '90 days'       THEN 'fresh'
    WHEN last_passed_at >  now() - interval '180 days'      THEN 'cooling'
    ELSE                                                          'stale'
  END AS freshness
FROM agg;

COMMENT ON VIEW student_skill_state IS
  'Skills Library S1: derived current-state per (student, skill). Aggregates skill.* events from learning_events. freshness bands 90/180 days. No row = untouched.';
