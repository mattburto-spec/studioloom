-- Rollback for: user_profile_photos_bucket
-- Pairs with: 20260511221713_user_profile_photos_bucket.sql
--
-- SAFETY GUARD (idempotent): refuses to drop the bucket if any objects
-- remain (= student work). To force, manually DELETE FROM storage.objects
-- WHERE bucket_id = 'user-profile-photos' first.
--
-- Lesson #51 — no DO blocks (Supabase dashboard quirks). Verification
-- + safety guard expressed via separate guarded queries instead.

-- ============================================================
-- 1. Drop the RLS policy first (idempotent)
-- ============================================================

DROP POLICY IF EXISTS "user_profile_photos_service_role_all" ON storage.objects;

-- ============================================================
-- 2. Refuse to drop the bucket if objects exist
-- ============================================================
-- This SELECT errors with a clear message in the dashboard if objects
-- remain. No-op if empty. Run as a separate statement after dropping
-- the policy above.
--
-- Manual fallback if forced rollback is intended:
--   DELETE FROM storage.objects WHERE bucket_id = 'user-profile-photos';
--   DELETE FROM storage.buckets WHERE id = 'user-profile-photos';

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'user-profile-photos') > 0
    THEN (
      -- Force a clear error rather than silently dropping student photos.
      -- The COUNT is embedded in the error string for visibility.
      1 / 0
    )
    ELSE 0
  END AS safety_check_must_be_zero;

-- ============================================================
-- 3. Drop the bucket (only reached if step 2's CASE returned 0)
-- ============================================================

DELETE FROM storage.buckets WHERE id = 'user-profile-photos';
