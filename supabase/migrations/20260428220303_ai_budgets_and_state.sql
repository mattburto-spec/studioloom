-- Migration: ai_budgets_and_state
-- Created: 20260428220303 UTC
-- Phase: Access Model v2 Phase 0.7b
--
-- WHY: Two tables for the per-student AI token-budget system (Decision 6,
--   IT audit F24/F19, monetisation seam §8.6 item 6) —
--
--   1. ai_budgets — per-subject token overrides. Polymorphic subject:
--      'student' | 'class' | 'school'. Phase 5 budget middleware reads
--      these to resolve a student's daily cap via cascade:
--        tier default (from schools.subscription_tier mapped by
--          admin_settings) →
--        school override (ai_budgets WHERE subject='school') →
--        class override (ai_budgets WHERE subject='class' for the
--          student's enrolled class) →
--        student override (ai_budgets WHERE subject='student')
--      Tighter overrides win (student beats class beats school).
--
--   2. ai_budget_state — per-student running counter. Tracks tokens
--      consumed today. Reset at midnight in school's timezone (Phase
--      0.1 schools.timezone column drives the reset cron). Records
--      last_warning_sent_at for nag throttling (one warning per day,
--      not per AI call).
--
-- IMPACT: 2 new tables. RLS Phase-0 baseline: school-scoped reads.
--   INSERT/UPDATE: deny-by-default — only Phase 5 budget middleware
--   (service role) increments counters; Phase 4 school-settings UI sets
--   overrides. No backfill — both ship empty. Tier defaults come from
--   admin_settings keys read at runtime, not from rows in ai_budgets.
-- ROLLBACK: paired .down.sql drops both tables.

-- ============================================================
-- 1. ai_budgets — per-subject token override
-- ============================================================
-- One row per (subject_id, subject_type). Updates overwrite. Setting
-- daily_token_cap = 0 effectively disables AI for that subject.

CREATE TABLE ai_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL,
  subject_type TEXT NOT NULL
    CHECK (subject_type IN ('student','class','school')),
  daily_token_cap INTEGER NOT NULL
    CHECK (daily_token_cap >= 0),
  set_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, subject_type)
);

-- Cascade lookup: "what's the cap for student X?" — primary access path
-- is the UNIQUE constraint above (used by app-layer cascade resolver).
-- The (subject_type) index helps "list all student overrides" admin
-- queries.
CREATE INDEX IF NOT EXISTS idx_ai_budgets_type
  ON ai_budgets(subject_type);

-- ============================================================
-- 2. ai_budget_state — per-student running counter
-- ============================================================
-- One row per student. Reset cron runs at midnight in
-- schools.timezone (Phase 0.1 column) and zeroes tokens_used_today,
-- bumping reset_at to next midnight. Phase 5 budget middleware
-- atomically increments tokens_used_today on every AI call and
-- compares against the cascade-resolved cap.

CREATE TABLE ai_budget_state (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  tokens_used_today INTEGER NOT NULL DEFAULT 0
    CHECK (tokens_used_today >= 0),
  -- Next reset boundary (midnight in school's local timezone)
  reset_at TIMESTAMPTZ NOT NULL,
  -- Throttle "you've used 80% of your daily cap" nags to one per day
  last_warning_sent_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reset cron query: "students whose reset_at has passed — wipe and
-- bump". Partial index keeps the active set small.
CREATE INDEX IF NOT EXISTS idx_ai_budget_state_due_reset
  ON ai_budget_state(reset_at)
  WHERE reset_at < now();

-- ============================================================
-- 3. RLS — Phase 0 baseline
-- ============================================================
-- ai_budgets:
--   - SELECT: teachers in same school can read all override rows scoped
--     to their school. (For subject_type='school' the subject_id IS
--     a school_id; for 'class'/'student', we resolve the school via
--     joins.) Phase 3 expands per can() helper.
-- ai_budget_state:
--   - SELECT: student self-read (via auth.uid() once Phase 1 unifies
--     student auth — for Phase 0 this is an empty set since students
--     don't have auth.users rows yet)
--   - SELECT: teachers in same school as the student can read
--   INSERT/UPDATE: deny-by-default (Phase 5 budget middleware uses
--   service role for atomic increments; Phase 4 school settings UI
--   uses service role for overrides)

ALTER TABLE ai_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budget_state ENABLE ROW LEVEL SECURITY;

-- ai_budgets: teachers can read overrides scoped to their school.
-- For subject_type = 'school', the subject_id IS the school_id.
-- For subject_type = 'class', look up the class's school_id.
-- For subject_type = 'student', look up the student's school_id (Phase 0.3 column).
CREATE POLICY "ai_budgets_school_teacher_read"
  ON ai_budgets FOR SELECT
  USING (
    CASE subject_type
      WHEN 'school' THEN
        subject_id IN (
          SELECT t.school_id FROM teachers t
          WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
        )
      WHEN 'class' THEN
        subject_id IN (
          SELECT c.id FROM classes c
          JOIN teachers t ON t.school_id = c.school_id
          WHERE t.id = auth.uid()
            AND t.school_id IS NOT NULL
            AND c.school_id IS NOT NULL
        )
      WHEN 'student' THEN
        subject_id IN (
          SELECT s.id FROM students s
          JOIN teachers t ON t.school_id = s.school_id
          WHERE t.id = auth.uid()
            AND t.school_id IS NOT NULL
            AND s.school_id IS NOT NULL
        )
      ELSE false
    END
  );

-- ai_budget_state: student self-read (anticipating Phase 1 auth.users
-- unification — for now this returns 0 rows since students.id !=
-- auth.uid() yet)
CREATE POLICY "ai_budget_state_student_self_read"
  ON ai_budget_state FOR SELECT
  USING (student_id = auth.uid());

-- ai_budget_state: teachers in same school as the student
CREATE POLICY "ai_budget_state_school_teacher_read"
  ON ai_budget_state FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN teachers t ON t.school_id = s.school_id
      WHERE t.id = auth.uid()
        AND t.school_id IS NOT NULL
        AND s.school_id IS NOT NULL
    )
  );

COMMENT ON TABLE ai_budgets IS
  'Per-subject AI token-cap overrides. Polymorphic subject (student / '
  'class / school). Cascade resolution: tier default → school → class '
  '→ student (tighter wins). Phase 5 middleware reads.';

COMMENT ON TABLE ai_budget_state IS
  'Per-student running counter. tokens_used_today increments atomically '
  'on each AI call. Reset cron zeroes at midnight in school timezone. '
  'last_warning_sent_at throttles 80%-cap nag emails to one/day.';

-- ============================================================
-- 4. Sanity check
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_budgets'
  ) THEN
    RAISE EXCEPTION 'Migration failed: ai_budgets missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_budget_state'
  ) THEN
    RAISE EXCEPTION 'Migration failed: ai_budget_state missing';
  END IF;
  RAISE NOTICE 'Migration ai_budgets_and_state applied OK: 2 tables + 2 indexes + 3 RLS policies';
END $$;
