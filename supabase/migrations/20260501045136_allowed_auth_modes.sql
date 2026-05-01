-- Migration: allowed_auth_modes
-- Created: 20260501045136 UTC
--
-- WHY: Phase 2.3 — adds per-school + per-class controls over which
-- authentication modes are offered on the login page. Lets China-locked
-- schools (where Google + Microsoft are blocked) restrict to
-- email_password only, and lets schools standardise on a single SSO
-- provider when their IT department mandates it.
-- IMPACT: ALTER schools (add column + CHECK), ALTER classes (add column
-- + CHECK). No RLS changes. No data migration — defaults preserve
-- existing behaviour.
-- ROLLBACK: paired .down.sql drops both columns + constraints.
--
-- Decisions (matt 1 May 2026):
-- - TEXT[] over JSONB — small fixed enum, simpler app code, indexable.
-- - 'apple' included in CHECK constraint now (Phase 2.4 forward-compat;
--   no follow-up migration needed when the feature flag scaffolds in).
-- - classes.allowed_auth_modes nullable — NULL means "inherit from
--   school". Non-null narrows further (subset enforcement is app-layer,
--   not DB CHECK, to avoid cross-table validation complexity per
--   Lesson #61).
-- - schools default = ['email_password', 'google', 'microsoft'] — every
--   existing school keeps current behaviour. China-locked schools opt
--   out post-migration via UPDATE.
-- - array_length(...) >= 1 in CHECK so schools cannot end up with an
--   empty allowlist that would lock everyone out.

-- ----------------------------------------------------------------------
-- schools.allowed_auth_modes
-- ----------------------------------------------------------------------

ALTER TABLE schools
  ADD COLUMN allowed_auth_modes TEXT[] NOT NULL
  DEFAULT ARRAY['email_password', 'google', 'microsoft']::TEXT[];

ALTER TABLE schools
  ADD CONSTRAINT schools_allowed_auth_modes_valid
  CHECK (
    allowed_auth_modes <@ ARRAY['email_password', 'google', 'microsoft', 'apple']::TEXT[]
    AND array_length(allowed_auth_modes, 1) >= 1
  );

COMMENT ON COLUMN schools.allowed_auth_modes IS
  'Phase 2.3: which auth modes the login page offers when scoped to this school. Subset of {email_password, google, microsoft, apple}. Default {email_password, google, microsoft}. China-locked schools should be set to {email_password} only.';

-- ----------------------------------------------------------------------
-- classes.allowed_auth_modes
-- ----------------------------------------------------------------------

ALTER TABLE classes
  ADD COLUMN allowed_auth_modes TEXT[] NULL;

ALTER TABLE classes
  ADD CONSTRAINT classes_allowed_auth_modes_valid
  CHECK (
    allowed_auth_modes IS NULL
    OR (
      allowed_auth_modes <@ ARRAY['email_password', 'google', 'microsoft', 'apple']::TEXT[]
      AND array_length(allowed_auth_modes, 1) >= 1
    )
  );

COMMENT ON COLUMN classes.allowed_auth_modes IS
  'Phase 2.3: per-class override of school.allowed_auth_modes. NULL means inherit from school. When set, narrows further to a subset (enforced in app layer, not DB).';
