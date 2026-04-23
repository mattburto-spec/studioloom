-- =====================================================================
-- 106_learning_events.sql
-- Skills Library Phase S1 — append-only completion log
--
-- Creates the cross-cutting learning_events table. Skill completions are
-- the first consumer but the design is polymorphic: subject_type +
-- subject_id let other future systems (Stones, crit board, Open Studio
-- milestones) write events against the same log.
--
-- Append-only: no UPDATE policies, no DELETE policies. Corrections are
-- new events (e.g. skill.quiz_retaken) not mutations of old rows.
--
-- Event type namespace convention: {domain}.{action}
--   skill.viewed
--   skill.quiz_passed
--   skill.quiz_failed
--   skill.refresh_passed
--   skill.refresh_acknowledged
--   skill.demonstrated   (teacher-marked)
--   skill.applied        (evidenced in a Stone/portfolio)
--
-- Future domains: stone.*, portfolio.*, critique.* — not defined here,
-- each domain spec will establish its own event vocabulary.
-- =====================================================================

CREATE TABLE IF NOT EXISTS learning_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL,                       -- denormalized from session; references auth.users implicitly
  event_type      text NOT NULL,                       -- e.g. 'skill.viewed'
  subject_type    text NOT NULL,                       -- e.g. 'skill_card'
  subject_id      uuid NOT NULL,                       -- e.g. skill_cards.id
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- event-specific data (quiz score, attempt #, etc.)
  schema_version  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Primary access patterns:
--  (1) "Show me events for student X" — sorted newest first
--  (2) "Show me events about subject Y" — e.g. all events on a specific skill_card
--  (3) Filter by event_type for derived views (e.g. student_skill_state)
CREATE INDEX IF NOT EXISTS learning_events_student_idx
  ON learning_events (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_events_subject_idx
  ON learning_events (subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_events_event_type_idx
  ON learning_events (event_type);

-- Composite index for the student_skill_state view's primary filter:
--   WHERE subject_type = 'skill_card' AND event_type LIKE 'skill.%'
-- aggregated per student + subject_id.
CREATE INDEX IF NOT EXISTS learning_events_skill_state_idx
  ON learning_events (subject_type, student_id, subject_id)
  WHERE subject_type = 'skill_card';

-- =====================================================================
-- RLS — append-only with student ownership
-- =====================================================================
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

-- Students can read their own events; teachers read their class's
-- students' events (policy tightened in S4 when teacher access patterns
-- are exercised; for S1, service role handles teacher reads).
DROP POLICY IF EXISTS learning_events_read_own ON learning_events;
CREATE POLICY learning_events_read_own ON learning_events
  FOR SELECT USING (auth.uid() = student_id);

-- Students can insert their own events only; server routes pass
-- student_id from validated session, so this is defence-in-depth.
DROP POLICY IF EXISTS learning_events_insert_own ON learning_events;
CREATE POLICY learning_events_insert_own ON learning_events
  FOR INSERT WITH CHECK (auth.uid() = student_id);

-- No UPDATE or DELETE policies — append-only. Service role bypasses
-- for any admin-level corrections.

COMMENT ON TABLE learning_events IS
  'Skills Library S1: cross-cutting append-only log. skill.* events are the first consumer; other domains register their own event vocabulary.';
