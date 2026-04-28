-- Rollback for: user_profiles
-- Pairs with: 20260428142618_user_profiles.sql
-- Phase: Access Model v2 Phase 0.5
--
-- Drop in reverse order: trigger → function → table.
-- RLS policies + indexes drop with CASCADE on the table.

DROP TRIGGER IF EXISTS on_auth_user_profile_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_profile();
DROP TABLE IF EXISTS user_profiles CASCADE;
