-- Migration: class_dj_block
-- Created: 20260513122638 UTC
--
-- WHY: Phase 2 of the Class DJ Activity Block — a 60-second classroom
-- music voting block. This migration mints the schema (5 new tables +
-- their RLS) and seeds the activity_blocks library row that lesson
-- editors will pick the block from.
--
-- IMPACT (5 new tables, 1 new activity_blocks row):
--   class_dj_rounds              one row per launched round
--   class_dj_suggestions         one row per AI synthesis (cap 3 per round)
--   class_dj_fairness_ledger     per-(class, student) EMA state (§3.6)
--   class_dj_ledger_resets       audit log of teacher + auto resets
--   class_dj_veto_overrides      teacher-expired persistent vetoes
--
-- ROLLBACK: paired .down.sql drops all 5 tables and removes the seed row.
--
-- BRIEF: docs/projects/class-dj-block-brief.md §3.1 (schema) + §3.4 (seed) + §3.6 (ledger semantics)
-- ALGORITHM (already shipped Phase 1): src/lib/class-dj/algorithm.ts + docs/specs/class-dj-algorithm.md

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. class_dj_rounds — one row per launched round
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.class_dj_rounds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id           UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  page_id           TEXT NOT NULL,
  activity_id       TEXT NOT NULL,                 -- stable ActivitySection.activityId
  class_id          UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  class_round_index INT NOT NULL,                  -- monotonic per class_id; PRNG seed input
  started_by        TEXT NOT NULL,                 -- 'teacher:<id>' (v1 — student self-launch deferred)
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds  SMALLINT NOT NULL CHECK (duration_seconds BETWEEN 30 AND 180),
  ends_at           TIMESTAMPTZ NOT NULL,
  closed_at         TIMESTAMPTZ NULL,              -- NULL = still open
  suggest_count     SMALLINT NOT NULL DEFAULT 0,
  version           SMALLINT NOT NULL DEFAULT 1,   -- matches student_tool_sessions.version
  conflict_mode     TEXT NULL CHECK (conflict_mode IN ('consensus','split','small_group')),
  CONSTRAINT class_dj_rounds_suggest_cap CHECK (suggest_count BETWEEN 0 AND 3),
  CONSTRAINT class_dj_rounds_ends_after_start CHECK (ends_at > started_at),
  UNIQUE (class_id, class_round_index)
);

-- One open round per (class, lesson page, activity_id) at a time.
CREATE UNIQUE INDEX class_dj_rounds_one_open
  ON public.class_dj_rounds (class_id, unit_id, page_id, activity_id)
  WHERE closed_at IS NULL;

CREATE INDEX class_dj_rounds_class_open_idx
  ON public.class_dj_rounds (class_id)
  WHERE closed_at IS NULL;

CREATE INDEX class_dj_rounds_unit_page_idx
  ON public.class_dj_rounds (unit_id, page_id);

COMMENT ON TABLE public.class_dj_rounds IS
  'Class DJ — one row per launched round. UNIQUE(class_id, class_round_index) gives the PRNG seed monotonic counter. The partial unique index on (class_id, unit_id, page_id, activity_id) WHERE closed_at IS NULL prevents double-launch.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. class_dj_suggestions — one row per AI synthesis attempt (cap 3 per round)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.class_dj_suggestions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id            UUID NOT NULL REFERENCES public.class_dj_rounds(id) ON DELETE CASCADE,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by        TEXT NOT NULL,                   -- 'student:<id>' or 'teacher:<id>'
  vote_count          SMALLINT NOT NULL,               -- snapshot of vote count at generation time
  items               JSONB NOT NULL,                  -- [{name, kind, why, image_url, spotify_url, explicit, mood_tags, ...}]
  prompt_hash         TEXT NULL,                       -- nudges variety on "Try another 3"
  candidate_pool_size SMALLINT NOT NULL,               -- size of Stage 3 LLM pool BEFORE Spotify enrichment
  spotify_drops       SMALLINT NOT NULL DEFAULT 0,     -- candidates dropped by enrichment
  prng_seed_hash      TEXT NOT NULL                    -- sha256(class_id||class_round_index||suggest_count) for replay
);

CREATE INDEX class_dj_suggestions_round_idx
  ON public.class_dj_suggestions (round_id);

CREATE INDEX class_dj_suggestions_generated_at_idx
  ON public.class_dj_suggestions (generated_at DESC);

COMMENT ON TABLE public.class_dj_suggestions IS
  'Class DJ — one row per Stages 3+4+5 synthesis. Multiple per round allowed (up to class_dj_rounds.suggest_count, capped at 3). items[] holds 3 picks with Spotify-enriched metadata. prng_seed_hash makes re-rolls replayable.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. class_dj_fairness_ledger — per-(class, student) EMA state (§3.6)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.class_dj_fairness_ledger (
  class_id            UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  served_score        REAL NOT NULL DEFAULT 0.5 CHECK (served_score BETWEEN 0 AND 1),
  seed_pickup_count   INT  NOT NULL DEFAULT 0 CHECK (seed_pickup_count >= 0),
  voice_weight        REAL NOT NULL DEFAULT 1.0 CHECK (voice_weight BETWEEN 0.5 AND 2.0),
  rounds_participated INT  NOT NULL DEFAULT 0 CHECK (rounds_participated >= 0),
  last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);

CREATE INDEX class_dj_fairness_ledger_class_idx
  ON public.class_dj_fairness_ledger (class_id);

CREATE INDEX class_dj_fairness_ledger_student_idx
  ON public.class_dj_fairness_ledger (student_id);

COMMENT ON TABLE public.class_dj_fairness_ledger IS
  'Class DJ — per-(class, student) EMA state. servedScore (0..1), voiceWeight (clamped 0.5..2.0), seedPickupCount, roundsParticipated. Updated by updateFairnessLedger() in src/lib/class-dj/algorithm.ts when teacher picks a suggestion. Reset via teacher button or auto-30-round safety net.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. class_dj_ledger_resets — audit log of resets
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.class_dj_ledger_resets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id                 UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  reset_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_by                 TEXT NOT NULL,             -- 'teacher:<id>' or 'auto:30-round-safety-net'
  rounds_since_last_reset  INT  NOT NULL CHECK (rounds_since_last_reset >= 0),
  rows_cleared             INT  NOT NULL CHECK (rows_cleared >= 0)
);

CREATE INDEX class_dj_ledger_resets_class_idx
  ON public.class_dj_ledger_resets (class_id, reset_at DESC);

COMMENT ON TABLE public.class_dj_ledger_resets IS
  'Class DJ — audit log of fairness ledger resets. Triggered by teacher button or auto-30-round safety net.';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. class_dj_veto_overrides — teacher-expired persistent vetoes
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.class_dj_veto_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  veto_text   TEXT NOT NULL,                     -- normalised lower-trimmed form
  expired_by  TEXT NOT NULL,                     -- 'teacher:<id>'
  expired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, veto_text)
);

CREATE INDEX class_dj_veto_overrides_class_idx
  ON public.class_dj_veto_overrides (class_id);

COMMENT ON TABLE public.class_dj_veto_overrides IS
  'Class DJ — teacher-expired persistent vetoes. The §3.3 persistent-veto query filters these out, allowing the teacher to manually un-block a genre that has accumulated as standing policy.';

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — default-deny on all 5 tables
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.class_dj_rounds            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_dj_suggestions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_dj_fairness_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_dj_ledger_resets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_dj_veto_overrides    ENABLE ROW LEVEL SECURITY;

-- ─── class_dj_rounds ─────────────────────────────────────────────────────
-- SELECT: enrolled students + class teacher
-- INSERT: class teacher only (v1 — student self-launch deferred to FU-DJ-SELFLAUNCH)
-- UPDATE: class teacher only (for closed_at)
-- DELETE: nobody

CREATE POLICY "class_dj_rounds_teacher_read"
  ON public.class_dj_rounds FOR SELECT
  USING (public.has_class_role(class_id));

CREATE POLICY "class_dj_rounds_student_read"
  ON public.class_dj_rounds FOR SELECT
  USING (
    class_id IN (
      SELECT cs.class_id
      FROM public.class_students cs
      WHERE cs.student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "class_dj_rounds_teacher_insert"
  ON public.class_dj_rounds FOR INSERT
  WITH CHECK (public.has_class_role(class_id));

CREATE POLICY "class_dj_rounds_teacher_update"
  ON public.class_dj_rounds FOR UPDATE
  USING (public.has_class_role(class_id))
  WITH CHECK (public.has_class_role(class_id));

-- ─── class_dj_suggestions ────────────────────────────────────────────────
-- SELECT: same as class_dj_rounds
-- INSERT/UPDATE/DELETE: service role only (no policy needed; default-deny
-- + ENABLE RLS means non-service-role traffic is blocked)

CREATE POLICY "class_dj_suggestions_teacher_read"
  ON public.class_dj_suggestions FOR SELECT
  USING (
    round_id IN (
      SELECT id FROM public.class_dj_rounds
      WHERE public.has_class_role(class_id)
    )
  );

CREATE POLICY "class_dj_suggestions_student_read"
  ON public.class_dj_suggestions FOR SELECT
  USING (
    round_id IN (
      SELECT r.id FROM public.class_dj_rounds r
      WHERE r.class_id IN (
        SELECT cs.class_id
        FROM public.class_students cs
        WHERE cs.student_id IN (
          SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
        )
      )
    )
  );

-- ─── class_dj_fairness_ledger ────────────────────────────────────────────
-- SELECT: class teacher (any row in their class) + the student themselves (own row)
-- INSERT/UPDATE/DELETE: service role only

CREATE POLICY "class_dj_fairness_ledger_teacher_read"
  ON public.class_dj_fairness_ledger FOR SELECT
  USING (public.has_class_role(class_id));

CREATE POLICY "class_dj_fairness_ledger_student_read_own"
  ON public.class_dj_fairness_ledger FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    )
  );

-- ─── class_dj_ledger_resets ──────────────────────────────────────────────
-- SELECT: class teacher only
-- INSERT/UPDATE/DELETE: service role only

CREATE POLICY "class_dj_ledger_resets_teacher_read"
  ON public.class_dj_ledger_resets FOR SELECT
  USING (public.has_class_role(class_id));

-- ─── class_dj_veto_overrides ─────────────────────────────────────────────
-- SELECT: class teacher only
-- INSERT: class teacher only
-- UPDATE/DELETE: nobody

CREATE POLICY "class_dj_veto_overrides_teacher_read"
  ON public.class_dj_veto_overrides FOR SELECT
  USING (public.has_class_role(class_id));

CREATE POLICY "class_dj_veto_overrides_teacher_insert"
  ON public.class_dj_veto_overrides FOR INSERT
  WITH CHECK (public.has_class_role(class_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Seed: activity_blocks library row for the Class DJ block (§3.4)
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.activity_blocks (
  teacher_id,
  title,
  description,
  prompt,
  framing,
  task,
  success_signal,
  source_type,
  bloom_level,
  time_weight,
  grouping,
  phase,
  activity_category,
  response_type,
  toolkit_tool_id,
  ai_rules,
  interactive_config,
  is_assessable,
  is_public,
  module,
  backfill_needs_review,
  copyright_flag
) VALUES (
  NULL,                                                       -- platform-owned
  'Class DJ',
  'Live class music vote — students drop a mood, AI suggests 3 the room can live with.',
  'Tap your vibe before the timer runs out.',                 -- legacy prompt column
  'Music sets the room. Let''s pick something together.',     -- framing
  'Tap your vibe before the timer runs out.',                 -- task
  'Three suggestions on screen the room can all live with.',  -- success_signal
  'manual',
  NULL,                                                       -- not applicable
  'quick',
  'whole_class',
  'studio_open',
  'social-environment',
  'class-dj',
  'class-dj',
  jsonb_build_object(
    'phase', 'neutral',
    'tone', 'playful, school-appropriate, ≤18 words per item',
    'rules', jsonb_build_array(
      'mainstream/radio-edit only',
      'honor vetoes literally',
      'variety across the 3',
      'deterministic ranking — LLM never picks'
    ),
    'forbidden_words', jsonb_build_array()
  ),
  jsonb_build_object(
    'component_id', 'ClassDjBlock',
    'tool_config', jsonb_build_object(
      'timer_seconds', 60,
      'gate_min_votes', 3,
      'max_suggestions', 3,
      'moods', jsonb_build_array('focus', 'build', 'vibe', 'crit', 'fun')
    ),
    'ai_endpoints', jsonb_build_array('student/class-dj-candidates', 'student/class-dj-narrate'),
    'state_schema', 'class_dj_vote_v1',
    'requires_challenge', false
  ),
  false,
  true,
  'studioloom',
  false,
  'own'
);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- POST-APPLY VERIFICATION (paste these into Supabase SQL Editor to check)
-- ─────────────────────────────────────────────────────────────────────────
--
-- 1. All 5 tables created with RLS enabled:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename LIKE 'class_dj_%' ORDER BY tablename;
--   Expected: 5 rows, all rowsecurity=true.
--
-- 2. Policy count per table:
--   SELECT tablename, count(*) FROM pg_policies
--   WHERE tablename LIKE 'class_dj_%' GROUP BY tablename ORDER BY tablename;
--   Expected:
--     class_dj_fairness_ledger  2
--     class_dj_ledger_resets    1
--     class_dj_rounds           4
--     class_dj_suggestions      2
--     class_dj_veto_overrides   2
--
-- 3. Seed row exists in activity_blocks:
--   SELECT id, title, response_type, toolkit_tool_id, is_public, source_type
--   FROM public.activity_blocks
--   WHERE response_type='class-dj' AND toolkit_tool_id='class-dj';
--   Expected: 1 row, title='Class DJ', source_type='manual', is_public=true.
--
-- ─────────────────────────────────────────────────────────────────────────
-- TRACKER LOG (run in the SAME session as the apply, per Lesson #83)
-- ─────────────────────────────────────────────────────────────────────────
--
-- INSERT INTO public.applied_migrations (name, applied_by, source, notes) VALUES
--   ('20260513122638_class_dj_block', 'matt+claude', 'manual',
--    'Class DJ Phase 2: 5 new tables (rounds, suggestions, fairness_ledger, ledger_resets, veto_overrides) + RLS + activity_blocks library row');
