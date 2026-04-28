-- Migration: user_profiles
-- Created: 20260428142618 UTC
-- Phase: Access Model v2 Phase 0.5 (Option B chosen 28 Apr — separate
--   user_profiles table extending auth.users, NOT direct columns on
--   auth.users; matches Supabase recommendation + existing teachers
--   pattern from mig 001)
--
-- WHY: Centralised platform-role storage for every Supabase auth user.
--   Today only `teachers` rows extend auth.users with platform-specific
--   fields. Phase 1 will bring students into auth.users too, and §8.7
--   community_member auth + §8.6 guardian auth will follow. All four
--   user types need a single queryable surface for "what kind of user
--   is this?" and "is this user a platform admin?". Phase 3's
--   permission helper reads this table on every can() check.
-- IMPACT: New table user_profiles with FK to auth.users(id) ON DELETE
--   CASCADE. New trigger fires alongside the existing handle_new_teacher
--   trigger on auth.users INSERT. RLS enabled with self-read +
--   platform_admin-anywhere policies. Backfill inserts user_profiles
--   for every existing teachers row with user_type='teacher'.
-- ROLLBACK: paired .down.sql drops trigger, function, table.
--
-- Why Option B over auth.users.user_type direct columns: Supabase
-- officially recommends not modifying auth.users; existing teachers
-- pattern already uses extension-via-FK; deviation cost (one JOIN per
-- permission check) is negligible vs the upgrade-safety + convention-
-- consistency gains.
--
-- Trigger design notes:
-- - The existing on_auth_user_created trigger (mig 002) inserts into
--   teachers for EVERY new auth.users row. That's a known issue for
--   Phase 1 (students would get spurious teachers rows). Phase 1 will
--   rewrite that trigger to switch on user_type.
-- - This migration adds a SECOND trigger on auth.users INSERT that
--   creates a user_profiles row. Defaults user_type to 'student' but
--   reads raw_user_meta_data->>'user_type' if the signup flow sets it
--   explicitly. The existing handle_new_teacher trigger continues to
--   create teachers rows; this one creates user_profiles rows.
-- - Both triggers fire AFTER INSERT and don't conflict.

-- ============================================================
-- 1. Create user_profiles table
-- ============================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL DEFAULT 'student'
    CHECK (user_type IN (
      'student',
      'teacher',
      'fabricator',
      'platform_admin',
      'community_member',
      'guardian'
    )),
  is_platform_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for queries that filter by user_type (e.g., "list all teachers
-- in the platform" for platform_admin views).
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type
  ON user_profiles(user_type);

-- Partial index for the rare platform_admin lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_platform_admin
  ON user_profiles(id) WHERE is_platform_admin = true;

-- ============================================================
-- 2. Auto-create trigger on auth.users INSERT
-- ============================================================
-- Fires alongside the existing handle_new_teacher trigger (mig 002).
-- Reads raw_user_meta_data->>'user_type' if the signup flow set it;
-- otherwise defaults to 'student'. is_platform_admin always defaults
-- to false on creation (set explicitly via service role).

CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_type, is_platform_admin)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'user_type',
      'student'
    ),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'handle_new_user_profile failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_created ON auth.users;
CREATE TRIGGER on_auth_user_profile_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- ============================================================
-- 3. Backfill from existing teachers
-- ============================================================
-- Every existing teachers row corresponds to an auth.users row already
-- (mig 001 FK constraint). Insert user_profiles for each with
-- user_type='teacher'. ON CONFLICT DO NOTHING in case the trigger
-- already fired during a parallel write.

INSERT INTO user_profiles (id, user_type, is_platform_admin)
SELECT
  t.id,
  'teacher',
  false
FROM teachers t
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. RLS — self-read + platform_admin reads any
-- ============================================================
-- Phase 3 permission helper rewrites these policies. For now:
-- - SELECT: own row + platform_admin sees any
-- - INSERT: blocked (only trigger + service role can write)
-- - UPDATE: blocked (only service role; Phase 3 expands)
-- - DELETE: cascade-only via auth.users

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_self_read"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "user_profiles_platform_admin_read"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.is_platform_admin = true
    )
  );

-- No INSERT/UPDATE/DELETE policies — those default to deny under RLS,
-- so only the SECURITY DEFINER trigger and service role can write.

-- ============================================================
-- 5. Sanity check
-- ============================================================

DO $$
DECLARE
  teacher_count INTEGER;
  profile_count INTEGER;
  expected_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    RAISE EXCEPTION 'Migration user_profiles failed: table missing';
  END IF;

  SELECT COUNT(*) INTO teacher_count FROM teachers;
  SELECT COUNT(*) INTO profile_count FROM user_profiles WHERE user_type = 'teacher';
  expected_count := teacher_count;

  IF profile_count < expected_count THEN
    RAISE EXCEPTION 'Backfill incomplete: % teachers, only % teacher user_profiles', teacher_count, profile_count;
  END IF;

  RAISE NOTICE 'Migration user_profiles applied OK';
  RAISE NOTICE '  user_profiles rows: % (% teacher-typed from backfill)', profile_count, profile_count;
END $$;
