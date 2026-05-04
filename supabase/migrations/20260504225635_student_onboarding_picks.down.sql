-- Rollback for: student_onboarding_picks
-- Pairs with: 20260504225635_student_onboarding_picks.sql

ALTER TABLE students DROP COLUMN IF EXISTS onboarding_picks;
