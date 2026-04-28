-- Rollback for: student_support_settings
-- Pairs with: 20260427115409_student_support_settings.sql

ALTER TABLE students DROP COLUMN IF EXISTS support_settings;
ALTER TABLE class_students DROP COLUMN IF EXISTS support_settings;
