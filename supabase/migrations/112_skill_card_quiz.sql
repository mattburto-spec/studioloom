-- =====================================================================
-- 112_skill_card_quiz.sql
-- Skill Card Quiz Engine — Phase A of the unified skill+badge quiz port.
--
-- Context: the existing safety-badges system has a mature quiz engine
-- (question pool, pass threshold, retake cooldown, scoring, 3-screen
-- runner). Rather than build a parallel S3 engine for skill cards, we
-- port the same data model onto skill_cards. Phase B migrates the 12
-- safety modules into this unified system.
--
-- This migration adds:
--   1. Quiz fields on skill_cards (quiz_questions JSONB, pass_threshold,
--      retake_cooldown_minutes, question_count)
--   2. skill_quiz_attempts table — per-attempt log mirroring
--      student_badges but scoped to skill cards
--
-- Schema choice notes:
--   - quiz_questions is JSONB (matches badges.question_pool shape) —
--     allows the same authoring UI + runner code to work on both.
--   - pass_threshold default 80 (matches safety badge default).
--   - retake_cooldown_minutes default 0 (no cooldown — authored per card).
--   - question_count NULL means "use full pool"; if set, the runner
--     randomly selects N questions per attempt (matches badge behaviour).
--   - NO expiry_months here. Safety badges have cert expiry (hard gate);
--     skill cards use freshness bands (soft UI nudge via learning_events).
--     If a future card needs cert-style expiry, add then.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Add quiz columns to skill_cards
-- ---------------------------------------------------------------------

ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS quiz_questions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Pass threshold as percentage 0-100. Default 80 matches badges.
-- NULL would mean "no quiz"; we use 80 as default + quiz_questions empty
-- array to signal no quiz (see `has_quiz` helper in app code).
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS pass_threshold INTEGER NOT NULL DEFAULT 80
  CHECK (pass_threshold BETWEEN 0 AND 100);

ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS retake_cooldown_minutes INTEGER NOT NULL DEFAULT 0
  CHECK (retake_cooldown_minutes >= 0);

-- NULL = use full pool. If set (e.g. 10), the runner random-selects that
-- many questions per attempt — allows a large pool with shorter tests.
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS question_count INTEGER
  CHECK (question_count IS NULL OR question_count > 0);

COMMENT ON COLUMN skill_cards.quiz_questions IS
  'JSONB array of quiz questions. Shape matches badges.question_pool: [{id, type, prompt, options?, correct_answer, explanation, topic?, difficulty?}]. Empty array = no quiz.';
COMMENT ON COLUMN skill_cards.pass_threshold IS
  'Percentage 0-100 required to pass the quiz (default 80).';
COMMENT ON COLUMN skill_cards.retake_cooldown_minutes IS
  'Minutes a student must wait between failed attempts (default 0 = no cooldown).';
COMMENT ON COLUMN skill_cards.question_count IS
  'If set, N questions are randomly selected from quiz_questions per attempt. NULL = use full pool.';

-- ---------------------------------------------------------------------
-- 2. skill_quiz_attempts table
-- ---------------------------------------------------------------------
-- Mirrors student_badges' per-attempt shape but scoped to skill cards.
-- We don't reuse student_badges because:
--   - student_badges.student_id is TEXT (legacy nanoid); skill card
--     student_ids are UUID (from students.id) to match learning_events.
--   - student_badges is badge-scoped with cert semantics (expires_at,
--     status='active'|'expired'|'revoked'); skill quiz attempts are
--     simpler (just the attempt log; state is derived via the existing
--     student_skill_state view reading learning_events).

CREATE TABLE IF NOT EXISTS skill_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_card_id UUID NOT NULL REFERENCES skill_cards(id) ON DELETE CASCADE,

  -- Outcome
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),

  -- Input details (for review + analytics)
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_taken_seconds INTEGER CHECK (time_taken_seconds >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary access pattern: "latest attempts by this student for this card"
-- (cooldown check + attempt-number increment).
CREATE INDEX IF NOT EXISTS skill_quiz_attempts_student_card_idx
  ON skill_quiz_attempts (student_id, skill_card_id, created_at DESC);

-- Secondary: "all attempts on this card" (teacher analytics, future).
CREATE INDEX IF NOT EXISTS skill_quiz_attempts_card_idx
  ON skill_quiz_attempts (skill_card_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------

ALTER TABLE skill_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Students can read their own attempts (for review screens).
DROP POLICY IF EXISTS skill_quiz_attempts_student_read ON skill_quiz_attempts;
CREATE POLICY skill_quiz_attempts_student_read ON skill_quiz_attempts
  FOR SELECT
  USING (
    -- Anonymous student sessions read their own rows via service-role
    -- API routes (which bypass RLS). This policy is a belt-and-braces
    -- allow for future authenticated-student flows; service role always
    -- bypasses regardless.
    student_id::text = coalesce(auth.jwt() ->> 'student_id', '')
  );

-- Service role only for writes — the API route validates + inserts.
-- No student/teacher INSERT policy (routes use service-role).

COMMENT ON TABLE skill_quiz_attempts IS
  'Per-attempt log for skill card quizzes. Student ID is students.id (UUID) to match learning_events. Separate from student_badges (cert semantics) — skill state is derived from learning_events via student_skill_state view.';
