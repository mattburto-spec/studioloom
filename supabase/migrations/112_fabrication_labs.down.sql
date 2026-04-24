-- Migration 112 DOWN: rollback fabrication_labs + lab_id columns
--
-- Order matters: drop dependent columns BEFORE dropping the table,
-- or the FK constraint blocks the drop.

-- ============================================================
-- 1. Drop dependent FK columns
-- ============================================================

ALTER TABLE classes DROP COLUMN IF EXISTS default_lab_id;
ALTER TABLE machine_profiles DROP COLUMN IF EXISTS lab_id;

-- ============================================================
-- 2. Drop the table (cascade takes indexes + policies + trigger)
-- ============================================================

DROP TABLE IF EXISTS fabrication_labs CASCADE;
