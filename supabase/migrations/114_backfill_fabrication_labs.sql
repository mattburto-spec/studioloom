-- Migration 114: backfill fabrication_labs + populate lab_id FKs
--
-- Preflight Phase 8-1. Idempotent — safe to re-run. Every teacher who
-- owns ≥1 machine_profile OR ≥1 class gets exactly one "Default lab"
-- row; then every teacher-owned machine_profile + every class gets
-- its lab_id / default_lab_id pointed at that default.
--
-- Refs:
--   - Brief:    docs/projects/preflight-phase-8-1-brief.md §4.2
--   - Parent:   docs/projects/preflight-phase-8-brief.md §5 Q2 (auto-create default lab)
--   - Depends:  migration 113 (fabrication_labs + lab_id columns)
--
-- History note: originally drafted as migration 113; renumbered to 114
-- after the 112 → 113 shift to avoid collision with origin/main's
-- 112_skill_card_quiz.sql (25 Apr 2026). Contents unchanged.
--
-- Idempotency:
--   - Section 1 INSERT skips teachers that already have a default lab
--     via NOT EXISTS guard. Unique partial index
--     uq_fabrication_labs_one_default_per_teacher is the belt to the
--     NOT EXISTS suspenders.
--   - Sections 2 + 3 UPDATE only rows where lab_id IS NULL, so a
--     second run touches 0 rows.
--
-- Teachers with zero fabrication footprint (no owned machines, no
-- classes) are deliberately skipped. They'll get a default lab on
-- first interaction with the lab admin UI (8-2's createLabIfNeeded).

-- ============================================================
-- 1. Create one "Default lab" per teacher with fabrication footprint
-- ============================================================

INSERT INTO fabrication_labs (teacher_id, name, description, is_default)
SELECT DISTINCT
  t.id AS teacher_id,
  'Default lab' AS name,
  'Auto-created during Phase 8 rollout. Rename or add more labs from /teacher/preflight/lab-setup.' AS description,
  true AS is_default
FROM auth.users t
WHERE (
  EXISTS (
    SELECT 1 FROM machine_profiles mp
    WHERE mp.teacher_id = t.id
      AND mp.is_system_template = false
  )
  OR EXISTS (
    SELECT 1 FROM classes c
    WHERE c.teacher_id = t.id
  )
)
AND NOT EXISTS (
  SELECT 1 FROM fabrication_labs fl
  WHERE fl.teacher_id = t.id AND fl.is_default = true
);

-- ============================================================
-- 2. Assign machine_profiles.lab_id for teacher-owned non-templates
-- ============================================================
--
-- System templates (teacher_id IS NULL, is_system_template = true)
-- stay NULL — they're cross-tenant seeds, not scoped to any lab.

UPDATE machine_profiles mp
SET lab_id = fl.id
FROM fabrication_labs fl
WHERE fl.teacher_id = mp.teacher_id
  AND fl.is_default = true
  AND mp.teacher_id IS NOT NULL
  AND mp.is_system_template = false
  AND mp.lab_id IS NULL;

-- ============================================================
-- 3. Assign classes.default_lab_id for every existing class
-- ============================================================

UPDATE classes c
SET default_lab_id = fl.id
FROM fabrication_labs fl
WHERE fl.teacher_id = c.teacher_id
  AND fl.is_default = true
  AND c.teacher_id IS NOT NULL
  AND c.default_lab_id IS NULL;
