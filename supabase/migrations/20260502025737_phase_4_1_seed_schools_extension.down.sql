-- Rollback for: phase_4_1_seed_schools_extension
-- Pairs with: 20260502025737_phase_4_1_seed_schools_extension.sql
--
-- DELETEs only Phase 4.1 entries: source='imported' added in this batch.
-- Bounded by created_at to avoid touching any pre-existing 'imported'
-- rows (none exist as of 2 May 2026, but the bound is defence-in-depth).
--
-- Won't touch source='ibo' (085_schools_seed.sql) or source='user_submitted'
-- (welcome wizard custom entries).
--
-- Idempotent — DELETE is safe on missing rows.

DELETE FROM schools
WHERE source = 'imported'
  AND created_at >= '2026-05-02 00:00:00+00'::timestamptz
  AND created_at < '2026-05-03 00:00:00+00'::timestamptz;
