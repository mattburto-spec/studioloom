-- Migration: fabrication_jobs_preferred_color
-- Created: 20260505010732 UTC
-- Phase: Preflight color preference v1 (4 May 2026 night)
--
-- WHY: Students submitting 3D-printer jobs need a way to indicate
--   their preferred color so the fab tech knows what filament to
--   load. Currently the fab guesses or asks. This is a v1 free-text
--   field with an UI dropdown of common school-makerspace colors +
--   an "Other (specify)" escape hatch. v2 (deferred) adds
--   per-machine `available_colors` so the picker filters by
--   currently-loaded filament.
--
-- IMPACT:
--   ADD COLUMN fabrication_jobs.preferred_color TEXT NULL
--     - Nullable: laser-cutter jobs leave it null (color is a
--       3D-printer concept; lasers care about material instead).
--     - Free text: orchestration validates ≤ 60 chars; UI
--       constrains to a hardcoded dropdown but accepts free-text
--       via "Other (specify)" path.
--     - No CHECK constraint: enums lock too tight for v1, the
--       value is read by humans (the fab) not the system.
--
-- ROLLBACK: paired .down.sql drops the column.
--
-- DEPS: 093 (machine_profiles + machine_category enum used to gate
--       UI visibility), 098 (fabrication_jobs base table).

ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS preferred_color TEXT NULL;

COMMENT ON COLUMN fabrication_jobs.preferred_color IS
  'Student-supplied preferred filament color for 3D-printer jobs (e.g. "PLA — Black", "PETG — Clear", "Other: glow-in-dark green"). NULL for laser-cutter jobs (color is a 3D concept). Free text, ≤ 60 chars enforced at orchestration layer. v1 — Phase 8.1d-COLORv1 (4 May 2026). v2 will add per-machine `machine_profiles.available_colors` filter.';
