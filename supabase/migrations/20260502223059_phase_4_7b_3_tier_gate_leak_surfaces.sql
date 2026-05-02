-- Migration: phase_4_7b_3_tier_gate_leak_surfaces
-- Created: 20260502223059 UTC
-- Phase: Access Model v2 Phase 4.7b-3 (tier-aware membership — RLS leak gates)
--
-- WHY: Per Decision 8 amendment + CWORK Q1 audit (signed off 2 May 2026 PM):
--   four RLS policies grant SCHOOL-WIDE reads to any teacher whose
--   teachers.school_id matches the row's school_id, with NO check on
--   the school's subscription_tier. Under tier-aware membership:
--
--     - school-tier school: flat governance, school-wide reads OK
--     - free / pro tier: personal schools (single member) — school-wide
--       reads are trivially their own data
--     - pilot / starter (legacy seed): no real teachers attached today;
--       defensive-gate now so if someone joins a starter-tier school
--       later they don't accidentally get school-wide reads
--
--   The four leak-surface policies (per CWORK audit):
--     1. audit_events_school_teacher_read           (mig 20260428215923)
--     2. student_mentors_school_teacher_read        (mig 20260428214735)
--     3. school_resources_school_read               (mig 20260428214009)
--     4. guardians_school_read                      (mig 20260428214009)
--
--   NOT in scope (intentional exclusions):
--     - school_responsibilities_school_read: per CWORK Q1, the role
--       mechanism itself depends on members seeing assignments. Low-
--       sensitivity org-structure exposure accepted.
--     - school_setting_changes policies (mig 20260502034114): every
--       teacher manages their OWN school's settings (whether personal
--       or shared); 2-teacher-confirm is enforced at the helper layer
--       (proposeSchoolSettingChange) via bootstrap-grace logic, not
--       at RLS. Not a leak surface under tier-aware model.
--     - Teacher directory: route-level concern (super-admin route is
--       already platform_admin-gated; settings-page teacher list is
--       fetched server-side). Filed FU-AV2-TEACHER-DIRECTORY-ROUTE-GATE
--       to ensure the route layer also tier-gates.
--     - School library (Phase 4.6 — not yet built): will be authored
--       gated from day one when Phase 4.6 ships.
--
-- IMPACT:
--   - 1 NEW SECURITY DEFINER helper: current_teacher_school_tier_school_id()
--     Returns auth.uid()'s teacher.school_id IFF that school is
--     subscription_tier='school'; else NULL.
--   - 4 RLS policies DROP + CREATE with new gating clause.
--   - Helper REVOKE FROM PUBLIC + GRANT TO authenticated per existing
--     pattern (Lessons #64 + #66).
--
-- ROLLBACK: paired .down.sql restores the original 4 policies + drops
--   the helper. Safe to roll back (no data dependency).
--
-- RECURSION SAFETY (Lesson #64): the helper joins teachers + schools
-- via SECURITY DEFINER so it bypasses RLS internally. Policies that
-- consume the helper don't recurse into the joined tables.

-- ============================================================
-- 1. SECURITY DEFINER helper
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_teacher_school_tier_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.school_id
  FROM teachers t
  JOIN schools s ON s.id = t.school_id
  WHERE t.id = auth.uid()
    AND t.school_id IS NOT NULL
    AND s.subscription_tier = 'school';
$$;

REVOKE EXECUTE ON FUNCTION public.current_teacher_school_tier_school_id()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_teacher_school_tier_school_id()
  TO authenticated;

COMMENT ON FUNCTION public.current_teacher_school_tier_school_id() IS
  'Phase 4.7b-3 — returns auth.uid()''s teacher.school_id ONLY if that '
  'school is on subscription_tier=''school''. Used by RLS policies on '
  '4 leak-surface tables (audit_events, student_mentors, '
  'school_resources, guardians) to gate school-wide reads. SECURITY '
  'DEFINER + locked search_path per Lessons #64 + #66.';

-- ============================================================
-- 2. audit_events_school_teacher_read — tier-gate
-- ============================================================

DROP POLICY IF EXISTS "audit_events_school_teacher_read" ON audit_events;

CREATE POLICY "audit_events_school_teacher_read"
  ON audit_events FOR SELECT
  USING (
    school_id = public.current_teacher_school_tier_school_id()
  );

-- ============================================================
-- 3. student_mentors_school_teacher_read — tier-gate
-- ============================================================
-- Original policy joined students.school_id to teacher's school_id.
-- New version uses the tier helper directly: if your school is
-- school-tier and matches the student's school, you can read.

DROP POLICY IF EXISTS "student_mentors_school_teacher_read" ON student_mentors;

CREATE POLICY "student_mentors_school_teacher_read"
  ON student_mentors FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.school_id = public.current_teacher_school_tier_school_id()
        AND s.school_id IS NOT NULL
    )
  );

-- ============================================================
-- 4. school_resources_school_read — tier-gate
-- ============================================================

DROP POLICY IF EXISTS "school_resources_school_read" ON school_resources;

CREATE POLICY "school_resources_school_read"
  ON school_resources FOR SELECT
  USING (
    school_id = public.current_teacher_school_tier_school_id()
  );

-- ============================================================
-- 5. guardians_school_read — tier-gate
-- ============================================================

DROP POLICY IF EXISTS "guardians_school_read" ON guardians;

CREATE POLICY "guardians_school_read"
  ON guardians FOR SELECT
  USING (
    school_id = public.current_teacher_school_tier_school_id()
  );

-- ============================================================
-- 6. Sanity check
-- ============================================================

DO $$
DECLARE
  v_helper_exists BOOLEAN;
  v_helper_secdef BOOLEAN;
  v_policy_count INT;
  v_audit_uses_helper BOOLEAN;
BEGIN
  -- Helper exists and is SECURITY DEFINER
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'current_teacher_school_tier_school_id'
      AND prosecdef = true
  ) INTO v_helper_exists;
  IF NOT v_helper_exists THEN
    RAISE EXCEPTION 'Migration failed: current_teacher_school_tier_school_id() '
                    'helper missing OR not SECURITY DEFINER';
  END IF;

  -- All 4 policies exist
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'audit_events_school_teacher_read',
      'student_mentors_school_teacher_read',
      'school_resources_school_read',
      'guardians_school_read'
    );
  IF v_policy_count != 4 THEN
    RAISE EXCEPTION 'Migration failed: expected 4 leak-surface policies, got %',
                    v_policy_count;
  END IF;

  -- Verify audit_events policy actually references the helper (Lesson #38
  -- shape-assertion — catches a re-inline regression).
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_events'
      AND policyname = 'audit_events_school_teacher_read'
      AND qual LIKE '%current_teacher_school_tier_school_id%'
  ) INTO v_audit_uses_helper;
  IF NOT v_audit_uses_helper THEN
    RAISE EXCEPTION 'Migration failed: audit_events policy does not reference '
                    'the tier helper (regression check)';
  END IF;

  RAISE NOTICE 'Migration phase_4_7b_3_tier_gate_leak_surfaces applied OK: '
               '1 helper + 4 policies recreated';
END $$;
