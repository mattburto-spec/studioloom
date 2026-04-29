-- Phase 1.4 CS-1 — student_badges: rewrite broken self-read policy
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-14-client-switch-brief.md §3.2 + §4 (CS-1)
-- Date: 30 April 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY (the broken-policy discovery)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 035 created `student_badges` with this policy:
--
--   CREATE POLICY student_badges_read_own ON student_badges
--     FOR SELECT USING (
--       student_id::text = COALESCE(current_setting('app.student_id', true), '')
--       OR student_id::text = COALESCE((current_setting('request.jwt.claims', true)::json->>'sub'), '')
--     );
--
-- Both branches of the OR are wrong post-Phase-1:
--
-- 1. `current_setting('app.student_id')` — the legacy custom-token sentinel
--    that was never actually set by the production auth path. It has been
--    returning '' (the COALESCE default) forever.
--
-- 2. `request.jwt.claims->>'sub'` — returns auth.users.id (the JWT subject),
--    NOT students.id. They are different UUIDs (Phase 1.1a established the
--    canonical chain via students.user_id). This branch never matches a
--    real student_id.
--
-- The schema-registry annotation reads `student_badges_read_own (their)`
-- (i.e. canonical chain) but the actual SQL has never been canonical.
-- App-level filtering in /api/student/safety/pending and the safety-badge
-- routes has been masking this since the table was created — students see
-- their own badges only because route code filters by studentId.
--
-- This is the same broken-policy class as the 3 Phase 1.5 rewrites
-- (competency_assessments, quest_journeys, design_conversations). Fixed
-- with the same canonical chain.
--
-- Lesson #54 sibling: registry said one thing, SQL did another. Schema-
-- registry scanner doesn't introspect policy SQL — it parses migration
-- filenames + table comments. Annotation drift goes unflagged.
--
-- ───────────────────────────────────────────────────────────────────────────
-- FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- DROP the broken policy. CREATE a new one using the canonical chain
-- auth.uid() → students.user_id → students.id = student_badges.student_id.
-- Indexed via idx_students_user_id (Phase 1.1a partial index) — fast
-- subquery.
--
-- Existing teacher policies (`student_badges_teacher_read`,
-- `student_badges_teacher_insert`) are untouched. They use a DIFFERENT
-- still-load-bearing teacher chain (students → classes → teacher_id =
-- auth.uid()) which is correct.
--
-- Migration 035's INSERT-on-student_badges is teacher-only via
-- `student_badges_teacher_insert`. Students never insert their own
-- badges (teachers award them). No student INSERT policy needed.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One DROP POLICY (broken `student_badges_read_own`)
-- - One CREATE POLICY (canonical-chain replacement)
-- - Existing `student_badges_teacher_read` + `student_badges_teacher_insert`
--   policies untouched
-- - No data change
--
-- POST-MIGRATION NOTE for schema-registry hygiene: the registry
-- annotation `student_badges_read_own (their)` is finally truthful.

DROP POLICY IF EXISTS student_badges_read_own ON student_badges;

CREATE POLICY student_badges_read_own ON student_badges
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY student_badges_read_own ON student_badges IS
  'Phase 1.4 CS-1 — Students authenticated via Supabase Auth can SELECT their own badges. Canonical chain auth.uid() → students.user_id → students.id. REWRITES the original migration 035 policy that used the never-functional current_setting(app.student_id) + jwt.claims->>sub pattern. Sibling fix to the Phase 1.5 broken-policy rewrites.';
