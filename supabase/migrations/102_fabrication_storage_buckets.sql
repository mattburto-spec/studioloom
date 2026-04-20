-- Migration 102: Supabase Storage buckets + service-role RLS for Preflight
--
-- Preflight Phase 1B-1-5. Creates 3 private buckets + service-role-only RLS
-- policies on storage.objects. Matches the FU-FF deny-all pattern used by
-- fabrication_scan_jobs and fabricator_sessions — RLS enabled with no
-- authenticated-role policy, service-role bypasses RLS for all access.
-- Granular path-based RLS (per-teacher/per-student) deferred to Phase 2.
--
-- Dashboard caveat: Supabase dashboard may intercept storage.buckets writes
-- differently than regular DDL. If the INSERT fails, fallback is manual
-- bucket creation via Dashboard → Storage → New bucket (private), then
-- apply ONLY the RLS portion (section 2) of this migration.
--
-- Refs:
--   - Brief:      docs/projects/preflight-phase-1b-1-brief.md (1B-1-5)
--   - Candidates: docs/projects/fabrication/migration-098-candidates.md (098h)
--   - Pattern:    FU-FF (deny-all via RLS-enabled-no-policy)
--   - Lessons:    #24 (idempotent), #45 (surgical), #51 (no DO blocks)

-- ============================================================
-- 1. Create buckets (private; signed-URL access only)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('fabrication-uploads',    'fabrication-uploads',    false),
  ('fabrication-thumbnails', 'fabrication-thumbnails', false),
  ('fabrication-pickup',     'fabrication-pickup',     false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS policies on storage.objects — service-role-only per bucket
-- ============================================================
-- Each bucket gets its own FOR ALL policy scoped by bucket_id. No
-- authenticated / anon policies — that role reads 0 rows. Service-role
-- bypasses RLS entirely by default in Supabase, so workers + signed-URL
-- issuers can read/write freely.

DROP POLICY IF EXISTS "fabrication_uploads_service_role_all" ON storage.objects;
CREATE POLICY "fabrication_uploads_service_role_all"
  ON storage.objects FOR ALL
  USING      (bucket_id = 'fabrication-uploads'    AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'fabrication-uploads'    AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "fabrication_thumbnails_service_role_all" ON storage.objects;
CREATE POLICY "fabrication_thumbnails_service_role_all"
  ON storage.objects FOR ALL
  USING      (bucket_id = 'fabrication-thumbnails' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'fabrication-thumbnails' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "fabrication_pickup_service_role_all" ON storage.objects;
CREATE POLICY "fabrication_pickup_service_role_all"
  ON storage.objects FOR ALL
  USING      (bucket_id = 'fabrication-pickup'     AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'fabrication-pickup'     AND auth.role() = 'service_role');

-- ============================================================
-- 3. Post-apply verification (run as separate queries in the dashboard)
-- ============================================================
-- No DO block per Lesson #51.
--
--   -- (a) 3 private buckets exist
--   SELECT id, name, public
--   FROM storage.buckets
--   WHERE id IN ('fabrication-uploads','fabrication-thumbnails','fabrication-pickup')
--   ORDER BY id;
--   -- Expected 3 rows, all public=false.
--
--   -- (b) 3 policies, one per bucket, cmd='ALL'
--   SELECT policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname LIKE 'fabrication_%_service_role_all'
--   ORDER BY policyname;
--   -- Expected 3 rows:
--   --   fabrication_pickup_service_role_all      | ALL
--   --   fabrication_thumbnails_service_role_all  | ALL
--   --   fabrication_uploads_service_role_all     | ALL
--
--   -- (c) RLS enabled on storage.objects (should already be t; sanity check)
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'objects'
--     AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='storage');
--   -- Expected: t
--
--   -- (d) No objects in any Preflight bucket yet (empty state)
--   SELECT bucket_id, COUNT(*)
--   FROM storage.objects
--   WHERE bucket_id IN ('fabrication-uploads','fabrication-thumbnails','fabrication-pickup')
--   GROUP BY bucket_id;
--   -- Expected: 0 rows (no objects, so GROUP BY returns empty set).
