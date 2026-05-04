-- Migration: consents
-- Created: 20260428214403 UTC
-- Phase: Access Model v2 Phase 0.6b
--
-- WHY: Forward-compat for FERPA / GDPR / PIPL / COPPA consent tracking.
--   Schools set regional defaults driven by `schools.region`; individuals
--   can override per consent_type. Schema lands in Phase 0 so historical
--   consent state is recordable from day one. UX wires Phase 5
--   alongside privacy export/delete endpoints.
-- IMPACT: One new table + RLS deny-all-by-default until Phase 5 expands.
--   Polymorphic subject identity (subject_id + subject_type) — can't FK
--   constraint enforce since subject lives in different tables; app
--   layer + RLS guarantee subject existence. No backfill — table ships
--   empty.
-- ROLLBACK: paired .down.sql drops the table.
--
-- subject_type values today: 'student' | 'teacher' | 'guardian' |
--   'community_member' (matches user_profiles.user_type subset that
--   has identifiable consent surface). 'fabricator' + 'platform_admin'
--   excluded — not subjects of consent tracking.
--
-- consent_type values: media_release (publish photos / work),
--   ai_usage (allow AI processing of student content),
--   directory_visibility (school directory listing visible to peers),
--   community_resource_contact (allow inviting parties to be contacted
--     via school_resources contact_info_jsonb gate),
--   third_party_share (LMS export, parent portal share, etc.)
--
-- basis values reflect legal-basis taxonomy from
--   docs/data-classification-taxonomy.md:
--   opt_in (active grant required) | opt_out (default-grant unless
--   revoked) | parental (parental consent for COPPA-protected minors) |
--   institutional (school holds the consent on behalf of subject —
--   typical for school-issued education contexts).
--
-- RLS Phase 0 baseline: deny-all-by-default. Service role bypasses RLS
-- to write consent records via Phase 5 privacy endpoints. Phase 5 adds
-- self-read + teacher-in-school-read policies. Documented as deliberate
-- to avoid RLS-enabled-no-policy drift in scan-rls-coverage.py.

CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL,
  subject_type TEXT NOT NULL
    CHECK (subject_type IN ('student','teacher','guardian','community_member')),
  consent_type TEXT NOT NULL
    CHECK (consent_type IN (
      'media_release',
      'ai_usage',
      'directory_visibility',
      'community_resource_contact',
      'third_party_share'
    )),
  basis TEXT NOT NULL
    CHECK (basis IN ('opt_in','opt_out','parental','institutional')),
  granted_at TIMESTAMPTZ NULL,
  granted_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoked_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  scope_jsonb JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A subject can have multiple consent rows over time (history).
  -- Latest non-revoked row wins (queried via WHERE revoked_at IS NULL
  -- ORDER BY created_at DESC LIMIT 1). No UNIQUE constraint — history
  -- preservation is the design.
  CHECK (
    (granted_at IS NULL AND revoked_at IS NULL)
    OR (granted_at IS NOT NULL AND (revoked_at IS NULL OR revoked_at >= granted_at))
  )
);

-- Lookup index: "what's the consent state for subject X, type Y?"
CREATE INDEX IF NOT EXISTS idx_consents_subject_lookup
  ON consents(subject_id, subject_type, consent_type, created_at DESC);

-- Active-only partial index for the common "current consent" query
CREATE INDEX IF NOT EXISTS idx_consents_active
  ON consents(subject_id, subject_type, consent_type)
  WHERE revoked_at IS NULL;

-- ============================================================
-- RLS — deny-all by default (Phase 5 expands)
-- ============================================================
-- Documented as deliberate per FU-FF / docs/security/rls-deny-all.md
-- pattern. Service role bypasses RLS for Phase 5 privacy endpoint
-- writes; no app-context reads in v2.

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents_deny_all_phase_0"
  ON consents FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY "consents_deny_all_phase_0" ON consents IS
  'Phase 0.6b: deny-all-by-default. Service role bypasses RLS to write '
  'consent records via Phase 5 privacy endpoints. Phase 5 replaces this '
  'policy with self-read + teacher-in-school-read. Documented to keep '
  'scan-rls-coverage.py drift report green.';

COMMENT ON TABLE consents IS
  'FERPA/GDPR/PIPL/COPPA consent tracking. Polymorphic subject (student / '
  'teacher / guardian / community_member). UX wired in Phase 5.';

-- ============================================================
-- Sanity check
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'consents'
  ) THEN
    RAISE EXCEPTION 'Migration consents failed: table missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'consents'
      AND policyname = 'consents_deny_all_phase_0'
  ) THEN
    RAISE EXCEPTION 'Migration consents failed: deny-all policy missing';
  END IF;
  RAISE NOTICE 'Migration consents applied OK: 1 table + 2 indexes + deny-all RLS';
END $$;
