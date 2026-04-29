-- Rollback for: user_locale_columns
-- Pairs with: 20260428132944_user_locale_columns.sql
-- Phase: Access Model v2 Phase 0.2

ALTER TABLE teachers DROP COLUMN IF EXISTS locale;
ALTER TABLE students DROP COLUMN IF EXISTS locale;
