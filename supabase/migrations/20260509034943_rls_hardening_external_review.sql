-- Migration: rls_hardening_external_review
-- Created: 20260509034943 UTC
--
-- WHY: closes RLS findings F-1, F-2, F-3, F-4, F-7, F-8, F-17, F-21 from
-- the 9 May 2026 external security review (cowork). Tables had wide-open
-- SELECT and/or WITH CHECK policies (USING (true) without TO service_role).
-- In Postgres RLS that opens the table to every role including
-- authenticated. A student authenticated via classcode-login has a real
-- Supabase JWT + the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY in
-- the client bundle); they could call PostgREST directly and dump the
-- entire table cross-school.
--
-- S1.1 PRE-APPLY DIAGNOSTIC (9 May 2026):
--   IDOR currently unexploitable in prod data — sparse pre-pilot state:
--     - 8 of 11 affected tables have 0 rows total
--     - discovery_sessions + class_units only contain the test student's
--       own data (2 rows each, matches service-role count)
--     - own_time_* tables (mig 028) DO NOT EXIST in prod (HTTP 404 from
--       PostgREST) — repo-vs-prod drift, tracked as
--       FU-PROD-MIGRATION-BACKLOG-AUDIT (P1).
--   Migration is defense-in-depth: locks down behaviour BEFORE pilot data
--   arrives. Applied now = no users disrupted, no smoke risk.
--   own_time_* sections wrapped in to_regclass() guards so the migration
--   is safe whether mig 028 is applied or not.
--
-- Source review:    docs/security/external-review-2026-05-09-findings.md
-- Closure brief:    docs/projects/security-closure-2026-05-09-brief.md
-- Smoke procedure:  docs/security/rls-smoke-2026-05-09.md
--
-- IMPACT:
--   F-1  student_tool_sessions  drop service_role_all → +student-self
--   F-2  open_studio_profiles   drop "Service role full access" → +student-self
--   F-3  discovery_sessions     drop service_all + broken JWT-sub policy → +canonical-chain
--   F-4  gallery_submissions    drop 3 wide-open → +student-self/+teacher-via-class
--   F-4/F-17 gallery_reviews    drop 3 wide-open → +student-self/+teacher-via-class
--   F-7  own_time_approvals     [GUARDED — table absent in prod 9 May]
--   F-7  own_time_projects      [GUARDED]
--   F-7  own_time_sessions      [GUARDED]
--   F-8  open_studio_status     drop *_read → +student-self/+teacher-via-class
--   F-8  open_studio_sessions   drop *_read → +student-self via status chain
--   F-21 class_units            drop "Anyone reads class_units" (mig 001:201) → +student-via-class_students/+teacher-via-class_members
--
-- CANONICAL PATTERN (post-Phase-1.5 standard, mig 20260429130732):
--   For tables with student_id UUID REFERENCES students(id):
--     USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()))
--   For tables with student_id TEXT (discovery_sessions, gallery_submissions):
--     USING (student_id IN (SELECT id::text FROM students WHERE user_id = auth.uid()))
--   For chained tables (own_time_sessions via project, open_studio_sessions
--   via status, gallery_reviews via reviewer_id text):
--     USING (parent_id IN (SELECT id FROM <parent> WHERE student_id IN (...)))
--   For class-scoped tables (class_units):
--     Student: class_id IN (SELECT class_id FROM class_students WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid()) AND is_active = true)
--     Teacher: class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
--           OR class_id IN (SELECT class_id FROM class_members WHERE member_user_id = auth.uid() AND removed_at IS NULL)
--
-- Service role BYPASSES RLS regardless of policy state. All API routes
-- on the touched tables use createAdminClient() (audit-before-touch grep
-- 9 May). Write paths unaffected; only behavioural change is PostgREST
-- direct-access from a student/teacher JWT is now properly scoped.
--
-- NON-RECURSION CHECK (Lesson #29 + Phase 1.4 cs3 audit):
--   Each new policy subqueries `students` and (where chain-needed) one
--   parent table. The `students` table has its own RLS but does NOT
--   subquery any of these tables. No cycle. Same chain shape live + smoke-
--   verified since Phase 1.4 (mig 20260430030419) and Phase 1.5
--   (mig 20260429130732).
--
-- ROLLBACK: paired .down.sql restores the pre-migration policies.
-- Re-opens the IDOR class — use only if smoke surfaces a hard regression
-- in admin-client routes.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- F-1: student_tool_sessions
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS service_role_all ON student_tool_sessions;

CREATE POLICY student_tool_sessions_student_self
  ON student_tool_sessions
  FOR ALL
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY student_tool_sessions_student_self ON student_tool_sessions IS
  'F-1 9 May 2026 — replaces wide-open service_role_all. Students self-access via auth.uid() → students.user_id → students.id chain. Service-role admin-client writers continue to bypass RLS.';

-- ═══════════════════════════════════════════════════════════════════════
-- F-2: open_studio_profiles
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Service role full access on open_studio_profiles" ON open_studio_profiles;

CREATE POLICY open_studio_profiles_student_self
  ON open_studio_profiles
  FOR ALL
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY open_studio_profiles_student_self ON open_studio_profiles IS
  'F-2 9 May 2026 — replaces wide-open "Service role full access" policy. High-PII table (Discovery profile, project narrative).';

-- ═══════════════════════════════════════════════════════════════════════
-- F-3: discovery_sessions
-- Drop both the wide-open service_all AND the broken strict policy. The
-- strict one (mig 047:48-50) compared students.id::text to JWT.sub which
-- is auth.users.id — they differ post-Phase-1.1a so it never matched.
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS discovery_sessions_service_all ON discovery_sessions;
DROP POLICY IF EXISTS discovery_sessions_student_select ON discovery_sessions;

CREATE POLICY discovery_sessions_student_self
  ON discovery_sessions
  FOR ALL
  USING (
    student_id IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY discovery_sessions_student_self ON discovery_sessions IS
  'F-3 9 May 2026 — replaces both the wide-open service_all AND the broken JWT-sub student_select. discovery_sessions.student_id is TEXT; cast students.id to text for comparison.';

-- ═══════════════════════════════════════════════════════════════════════
-- F-4 + F-17: gallery_submissions + gallery_reviews
-- ═══════════════════════════════════════════════════════════════════════

-- ── gallery_submissions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Students insert own submissions" ON gallery_submissions;
DROP POLICY IF EXISTS "Students read gallery submissions" ON gallery_submissions;
DROP POLICY IF EXISTS "Teachers read all submissions" ON gallery_submissions;

CREATE POLICY gallery_submissions_student_self
  ON gallery_submissions
  FOR ALL
  USING (
    student_id IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY gallery_submissions_teacher_class_read
  ON gallery_submissions
  FOR SELECT
  USING (
    round_id IN (
      SELECT gr.id FROM gallery_rounds gr
      WHERE gr.class_id IN (
        SELECT id FROM classes WHERE teacher_id = auth.uid()
        UNION
        SELECT class_id FROM class_members
          WHERE member_user_id = auth.uid() AND removed_at IS NULL
      )
    )
  );

COMMENT ON POLICY gallery_submissions_student_self ON gallery_submissions IS
  'F-4 9 May 2026 — replaces wide-open Students/Teachers read + the tautological student_id = student_id INSERT check. API still enforces effort-gating + round-class-membership.';

-- ── gallery_reviews ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students insert reviews" ON gallery_reviews;
DROP POLICY IF EXISTS "Students read reviews" ON gallery_reviews;
DROP POLICY IF EXISTS "Teachers read all reviews" ON gallery_reviews;

CREATE POLICY gallery_reviews_student_self
  ON gallery_reviews
  FOR ALL
  USING (
    reviewer_id IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    reviewer_id IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY gallery_reviews_teacher_class_read
  ON gallery_reviews
  FOR SELECT
  USING (
    round_id IN (
      SELECT gr.id FROM gallery_rounds gr
      WHERE gr.class_id IN (
        SELECT id FROM classes WHERE teacher_id = auth.uid()
        UNION
        SELECT class_id FROM class_members
          WHERE member_user_id = auth.uid() AND removed_at IS NULL
      )
    )
  );

COMMENT ON POLICY gallery_reviews_student_self ON gallery_reviews IS
  'F-4/F-17 9 May 2026 — replaces wide-open Students/Teachers read + INSERT WITH CHECK (true). reviewer_id::text bound to caller students.id via canonical chain.';

-- ═══════════════════════════════════════════════════════════════════════
-- F-7: own_time_* (mig 028) — table-existence-guarded
-- S1.1 smoke (9 May) confirmed these tables DO NOT EXIST in prod
-- (HTTP 404 from PostgREST). Mig 028 was never applied. Wrap each
-- in to_regclass() guards so this migration is safe to apply NOW
-- (skip own_time_*) and ALSO safe to re-run if mig 028 is applied
-- later (would create the correct policies on existing tables).
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.own_time_approvals') IS NOT NULL THEN
    DROP POLICY IF EXISTS own_time_approvals_read ON own_time_approvals;
    EXECUTE $sql$
      CREATE POLICY own_time_approvals_student_self
        ON own_time_approvals
        FOR SELECT
        USING (
          student_id IN (
            SELECT id FROM students WHERE user_id = auth.uid()
          )
        )
    $sql$;
    EXECUTE $sql$
      CREATE POLICY own_time_approvals_teacher_class_read
        ON own_time_approvals
        FOR SELECT
        USING (
          class_id IN (
            SELECT id FROM classes WHERE teacher_id = auth.uid()
            UNION
            SELECT class_id FROM class_members
              WHERE member_user_id = auth.uid() AND removed_at IS NULL
          )
        )
    $sql$;
  END IF;

  IF to_regclass('public.own_time_projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS own_time_projects_read ON own_time_projects;
    EXECUTE $sql$
      CREATE POLICY own_time_projects_student_self
        ON own_time_projects
        FOR SELECT
        USING (
          student_id IN (
            SELECT id FROM students WHERE user_id = auth.uid()
          )
        )
    $sql$;
    EXECUTE $sql$
      CREATE POLICY own_time_projects_teacher_class_read
        ON own_time_projects
        FOR SELECT
        USING (
          approval_id IN (
            SELECT id FROM own_time_approvals
            WHERE class_id IN (
              SELECT id FROM classes WHERE teacher_id = auth.uid()
              UNION
              SELECT class_id FROM class_members
                WHERE member_user_id = auth.uid() AND removed_at IS NULL
            )
          )
        )
    $sql$;
  END IF;

  IF to_regclass('public.own_time_sessions') IS NOT NULL THEN
    DROP POLICY IF EXISTS own_time_sessions_read ON own_time_sessions;
    EXECUTE $sql$
      CREATE POLICY own_time_sessions_student_self
        ON own_time_sessions
        FOR SELECT
        USING (
          project_id IN (
            SELECT id FROM own_time_projects
            WHERE student_id IN (
              SELECT id FROM students WHERE user_id = auth.uid()
            )
          )
        )
    $sql$;
    EXECUTE $sql$
      CREATE POLICY own_time_sessions_teacher_class_read
        ON own_time_sessions
        FOR SELECT
        USING (
          project_id IN (
            SELECT p.id FROM own_time_projects p
            WHERE p.approval_id IN (
              SELECT id FROM own_time_approvals
              WHERE class_id IN (
                SELECT id FROM classes WHERE teacher_id = auth.uid()
                UNION
                SELECT class_id FROM class_members
                  WHERE member_user_id = auth.uid() AND removed_at IS NULL
              )
            )
          )
        )
    $sql$;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- F-8: open_studio_status + open_studio_sessions
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS open_studio_status_read ON open_studio_status;

CREATE POLICY open_studio_status_student_self
  ON open_studio_status
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY open_studio_status_teacher_class_read
  ON open_studio_status
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
      UNION
      SELECT class_id FROM class_members
        WHERE member_user_id = auth.uid() AND removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS open_studio_sessions_read ON open_studio_sessions;

CREATE POLICY open_studio_sessions_student_self
  ON open_studio_sessions
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY open_studio_sessions_teacher_via_status
  ON open_studio_sessions
  FOR SELECT
  USING (
    status_id IN (
      SELECT id FROM open_studio_status
      WHERE class_id IN (
        SELECT id FROM classes WHERE teacher_id = auth.uid()
        UNION
        SELECT class_id FROM class_members
          WHERE member_user_id = auth.uid() AND removed_at IS NULL
      )
    )
  );

COMMENT ON POLICY open_studio_status_student_self ON open_studio_status IS
  'F-8 9 May 2026 — replaces wide-open *_read.';
COMMENT ON POLICY open_studio_sessions_student_self ON open_studio_sessions IS
  'F-8 9 May 2026 — replaces wide-open *_read. status_id chain for teacher view.';

-- ═══════════════════════════════════════════════════════════════════════
-- F-21: class_units (mig 001:201) — never-replaced wide-open SELECT
-- Critical: existing student-side units SELECT policy (mig 20260430030419
-- "Students read own assigned units") subqueries class_units. The new
-- class_units student policy MUST allow students to read their own
-- enrollment-unit junction or the inner subquery returns 0 → students
-- see no units.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone reads class_units" ON class_units;

CREATE POLICY class_units_student_self_read
  ON class_units
  FOR SELECT
  USING (
    class_id IN (
      SELECT cs.class_id FROM class_students cs
      WHERE cs.student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
      AND cs.is_active = true
    )
  );

CREATE POLICY class_units_teacher_class_read
  ON class_units
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
      UNION
      SELECT class_id FROM class_members
        WHERE member_user_id = auth.uid() AND removed_at IS NULL
    )
  );

COMMENT ON POLICY class_units_student_self_read ON class_units IS
  'F-21 9 May 2026 — replaces "Anyone reads class_units" (mig 001 wide-open SELECT, never tightened). Required for the existing units student-read policy (mig 20260430030419) which subqueries class_units.';

COMMIT;
