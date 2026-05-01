-- Rollback for: allowed_auth_modes
-- Pairs with: 20260501045136_allowed_auth_modes.sql

ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_allowed_auth_modes_valid;
ALTER TABLE classes DROP COLUMN IF EXISTS allowed_auth_modes;

ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_allowed_auth_modes_valid;
ALTER TABLE schools DROP COLUMN IF EXISTS allowed_auth_modes;
