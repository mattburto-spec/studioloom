-- Migration: user_profile_photos_bucket
-- Created: 20260511221713 UTC
-- Phase: Project Spec v2 Phase D — storage bucket for User Profile slot 7
--   (optional photo / sketch of the user the student is designing for).
--
-- WHY: Per the v2 split brief §12.4, Matt chose Option B — mint a new
--   dedicated `user-profile-photos` bucket rather than reusing the
--   existing `responses` bucket. Cleaner separation, room to apply
--   user-photo-specific moderation policy later (face-blur, age-
--   appropriate filtering, retention) without affecting the much
--   broader `responses` bucket which carries every student text/image
--   upload.
--
-- IMPACT:
--   1 NEW storage bucket: user-profile-photos (private)
--   1 NEW RLS policy on storage.objects scoped to bucket_id =
--     'user-profile-photos', service_role-only ALL (deny-all-by-default
--     pattern from migration 102 + FU-FF).
--
-- READ + WRITE PATH:
--   Writes go through POST /api/student/user-profile/upload-photo,
--   using createAdminClient() (service-role) → bypasses RLS by design.
--   Path shape: `<student_id>/<unit_id>.<ext>` — one photo per student
--   per unit, upserts allowed for "Replace" behaviour. URL stored as
--   the proxy form `/api/storage/user-profile-photos/<path>` in
--   student_unit_user_profiles.slot_7.value.url.
--   Reads go through GET /api/storage/[bucket]/[...path] which mints a
--   fresh 5-min signed URL after auth-gating per the global storage
--   proxy convention (security-plan.md P-3).
--
-- DASHBOARD CAVEAT (per migration 102): Supabase dashboard may
-- intercept storage.buckets writes. If the INSERT fails, fall back to
-- manual bucket creation via Dashboard → Storage → New bucket
-- (user-profile-photos, private), then apply ONLY the RLS portion
-- (section 2) of this migration.
--
-- ROLLBACK: paired .down.sql drops the policy + bucket (only if empty;
--   safety guard refuses if any objects remain).

-- ============================================================
-- 1. Create bucket (private; signed-URL access only via /api/storage proxy)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-profile-photos', 'user-profile-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS policy — service-role-only ALL (deny-all for authenticated/anon)
-- ============================================================

DROP POLICY IF EXISTS "user_profile_photos_service_role_all" ON storage.objects;
CREATE POLICY "user_profile_photos_service_role_all"
  ON storage.objects FOR ALL
  USING      (bucket_id = 'user-profile-photos' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'user-profile-photos' AND auth.role() = 'service_role');

-- ============================================================
-- 3. Post-apply verification (run as separate queries in the dashboard)
-- ============================================================
-- No DO block per Lesson #51 — Supabase dashboard chokes on them.
--
--   -- (a) Bucket exists, private
--   SELECT id, name, public
--   FROM storage.buckets
--   WHERE id = 'user-profile-photos';
--   -- Expected: 1 row, public = false
--
--   -- (b) Policy exists
--   SELECT policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname = 'user_profile_photos_service_role_all';
--   -- Expected: 1 row, cmd = 'ALL'
