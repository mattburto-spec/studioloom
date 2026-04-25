-- Migration 116: fabricators.school_id index for FU-P access-model-v2 prep
--
-- Subtle history: `fabricators.school_id` was ALREADY reserved as a
-- nullable FK in migration 097 (Phase 1A, 20 Apr 2026). We didn't
-- realise during the Phase 8 FU-P plan revision (25 Apr PM) until
-- after this migration was drafted. So the ADD COLUMN IF NOT EXISTS
-- below is a no-op on prod — the column already exists. What this
-- migration actually buys us:
--
--   1. The partial index on school_id (idx_fabricators_school_id) —
--      not present in 097. FU-P-2's RLS policies will be filtered
--      by school_id and benefit from this index.
--
--   2. Idempotent re-statement of the column shape, so the schema
--      registry + this file agree (097 only had it inline in CREATE
--      TABLE; this makes the school_id reservation explicit in the
--      migration log).
--
-- Refs:
--   - Brief:  docs/projects/fu-p-access-model-v2-plan.md (revised 25 Apr PM)
--   - Phase 8 checkpoint: docs/projects/preflight-phase-8-checkpoint-8-1.md
--                          (PH8-FU-FAB-SCHOOL-SCOPING entry)
--   - Pattern: migration 113_fabrication_labs.sql §6 (reserved school_id)
--   - Lessons: #51 (no DO/DECLARE verify blocks)
--
-- Behaviour change v1: ZERO. The column is NULL on every existing
-- row + every new row until FU-P flips it to NOT NULL. RLS policies
-- on fabricators still scope by `invited_by_teacher_id = auth.uid()`.

-- ============================================================
-- 1. Re-state column reservation (idempotent — already in mig 097)
-- ============================================================
--
-- ON DELETE SET NULL — same pattern as machine_profiles.school_id
-- and fabrication_labs.school_id. If a school is ever deleted (rare
-- but possible during admin cleanup), fabricators stay alive but
-- become school-orphaned. FU-P-2's RLS rewrite will need to handle
-- that edge case explicitly.
--
-- IF NOT EXISTS guard: in 097 the column was added as part of the
-- CREATE TABLE; this re-statement is a safety net for any environment
-- that somehow drifted. Should be a no-op on prod.

ALTER TABLE fabricators
  ADD COLUMN IF NOT EXISTS school_id UUID NULL
    REFERENCES schools(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Partial index — only useful when the column is populated
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fabricators_school_id
  ON fabricators(school_id)
  WHERE school_id IS NOT NULL;

-- ============================================================
-- 3. (deliberately no RLS changes here)
-- ============================================================
-- The existing per-teacher policies on `fabricators` keep working.
-- FU-P-2 will drop + replace them with school-membership-scoped
-- versions in a single transaction. See fu-p-access-model-v2-plan.md
-- §FU-P-2 for the full rewrite.
