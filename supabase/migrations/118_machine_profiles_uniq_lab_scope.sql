-- Migration 118: rescope the per-teacher machine-name unique index.
--
-- Phase 8.1d-13. The pre-existing index `uq_machine_profiles_teacher_name`
-- (added in 093) was scoped on (teacher_id, name) WHERE teacher_id IS
-- NOT NULL. Two real-world problems surfaced during the Phase 8.1
-- prod smoke (26 Apr):
--
--   1. Soft-deleted machines (`is_active = false`) still held names
--      hostage. A teacher who deactivated "Bambu Lab P1S" earlier in
--      the smoke could not re-add a machine with that name —
--      Postgres fired 23505, the API surfaced "you already have a
--      machine with that name", and the truth (a deactivated row in
--      the bin) was hidden from the UX.
--
--   2. The constraint scope was wrong-shaped for the real-world
--      multi-lab case. A school with 4 Bambu P1S printers across 2
--      labs shouldn't have to invent 4 unique names — two labs each
--      having a "Bambu Lab P1S" is the natural identity. The right
--      scope is (teacher_id, lab_id, name).
--
-- Both issues fix together by:
--   - Adding `lab_id` to the unique key (per-lab, not per-teacher)
--   - Excluding `is_active = false` from the predicate
--
-- Migration is strictly weaker than the old constraint:
--   - Adding lab_id to the key only ALLOWS more combinations
--   - Excluding inactive rows only ALLOWS more inserts
-- Therefore no existing row can violate the new index — safe to
-- apply against any data state.
--
-- NULL lab_id (orphan/unassigned bucket): Postgres treats NULL as
-- distinct in a unique index by default, so two orphan machines
-- with the same name would be allowed. That's acceptable — the
-- orphan bucket is a transient state during lab moves; teachers
-- shouldn't park different machines under the same name there for
-- long.

DROP INDEX IF EXISTS uq_machine_profiles_teacher_name;

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_profiles_teacher_lab_name
  ON machine_profiles (teacher_id, lab_id, name)
  WHERE teacher_id IS NOT NULL AND is_active = true;
