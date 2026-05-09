-- Rollback for: rls_hardening_external_review
-- Pairs with: 20260509034943_rls_hardening_external_review.sql
--
-- Restores the pre-migration RLS state. WARNING: re-opens the IDOR class
-- flagged by the 9 May external review (F-1, F-2, F-3, F-4, F-7, F-8,
-- F-17, F-21). Use only if S1 smoke surfaces an unexpected lockout that
-- points conclusively at one of the new policies (admin-client routes
-- should be unaffected because service-role bypasses RLS).
--
-- own_time_* sections wrapped in to_regclass() guards so the rollback is
-- safe whether mig 028 was applied or not.

BEGIN;

-- ── F-1: student_tool_sessions ────────────────────────────────────────
DROP POLICY IF EXISTS student_tool_sessions_student_self ON student_tool_sessions;
CREATE POLICY service_role_all ON student_tool_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ── F-2: open_studio_profiles ─────────────────────────────────────────
DROP POLICY IF EXISTS open_studio_profiles_student_self ON open_studio_profiles;
CREATE POLICY "Service role full access on open_studio_profiles"
  ON open_studio_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- ── F-3: discovery_sessions ───────────────────────────────────────────
DROP POLICY IF EXISTS discovery_sessions_student_self ON discovery_sessions;
CREATE POLICY discovery_sessions_student_select
  ON discovery_sessions FOR SELECT
  USING (student_id = current_setting('request.jwt.claims', true)::json->>'sub');
CREATE POLICY discovery_sessions_service_all
  ON discovery_sessions FOR ALL
  USING (true) WITH CHECK (true);

-- ── F-4 + F-17: gallery_submissions + gallery_reviews ─────────────────
DROP POLICY IF EXISTS gallery_submissions_student_self ON gallery_submissions;
DROP POLICY IF EXISTS gallery_submissions_teacher_class_read ON gallery_submissions;
DROP POLICY IF EXISTS gallery_reviews_student_self ON gallery_reviews;
DROP POLICY IF EXISTS gallery_reviews_teacher_class_read ON gallery_reviews;

CREATE POLICY "Students insert own submissions"
  ON gallery_submissions FOR INSERT
  WITH CHECK (student_id = student_id);
CREATE POLICY "Students read gallery submissions"
  ON gallery_submissions FOR SELECT USING (true);
CREATE POLICY "Teachers read all submissions"
  ON gallery_submissions FOR SELECT USING (true);

CREATE POLICY "Students insert reviews"
  ON gallery_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Students read reviews"
  ON gallery_reviews FOR SELECT USING (true);
CREATE POLICY "Teachers read all reviews"
  ON gallery_reviews FOR SELECT USING (true);

-- ── F-7: own_time_* (guarded — tables don't exist in current prod) ──
DO $$
BEGIN
  IF to_regclass('public.own_time_approvals') IS NOT NULL THEN
    DROP POLICY IF EXISTS own_time_approvals_student_self ON own_time_approvals;
    DROP POLICY IF EXISTS own_time_approvals_teacher_class_read ON own_time_approvals;
    EXECUTE 'CREATE POLICY own_time_approvals_read ON own_time_approvals FOR SELECT USING (true)';
  END IF;
  IF to_regclass('public.own_time_projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS own_time_projects_student_self ON own_time_projects;
    DROP POLICY IF EXISTS own_time_projects_teacher_class_read ON own_time_projects;
    EXECUTE 'CREATE POLICY own_time_projects_read ON own_time_projects FOR SELECT USING (true)';
  END IF;
  IF to_regclass('public.own_time_sessions') IS NOT NULL THEN
    DROP POLICY IF EXISTS own_time_sessions_student_self ON own_time_sessions;
    DROP POLICY IF EXISTS own_time_sessions_teacher_class_read ON own_time_sessions;
    EXECUTE 'CREATE POLICY own_time_sessions_read ON own_time_sessions FOR SELECT USING (true)';
  END IF;
END $$;

-- ── F-8: open_studio_status + open_studio_sessions ───────────────────
DROP POLICY IF EXISTS open_studio_status_student_self ON open_studio_status;
DROP POLICY IF EXISTS open_studio_status_teacher_class_read ON open_studio_status;
DROP POLICY IF EXISTS open_studio_sessions_student_self ON open_studio_sessions;
DROP POLICY IF EXISTS open_studio_sessions_teacher_via_status ON open_studio_sessions;

CREATE POLICY open_studio_status_read ON open_studio_status
  FOR SELECT USING (true);
CREATE POLICY open_studio_sessions_read ON open_studio_sessions
  FOR SELECT USING (true);

-- ── F-21: class_units ─────────────────────────────────────────────────
DROP POLICY IF EXISTS class_units_student_self_read ON class_units;
DROP POLICY IF EXISTS class_units_teacher_class_read ON class_units;

CREATE POLICY "Anyone reads class_units"
  ON class_units FOR SELECT USING (true);

COMMIT;
