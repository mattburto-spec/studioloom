-- Migration: privatise_legacy_buckets
-- Created: 20260508232012 UTC
--
-- WHY: closes P-3 of docs/security/security-plan.md. The `responses`,
-- `unit-images`, and `knowledge-media` buckets were public, with
-- URL-guessable paths (`{studentId}/{unitId}/{pageId}/{timestamp}.{ext}`).
-- Anyone who knew or guessed a student UUID could iterate file names and
-- pull student photos / avatars. The fix flips the buckets to private,
-- routes all reads through the new auth-gated /api/storage proxy at
-- src/app/api/storage/[bucket]/[...path]/route.ts, and rewrites stored
-- URL columns from the legacy `https://xxx.supabase.co/storage/v1/...`
-- shape to the new `/api/storage/{bucket}/{path}` shape.
--
-- IMPACT:
--   - storage.buckets.public flipped to false for 3 buckets.
--   - Pre-existing public-read RLS policies on storage.objects (if any
--     remain from initial setup) are dropped. service_role bypasses RLS
--     (deny-all-by-design pattern, see docs/security/rls-deny-all.md).
--   - URL columns rewritten in-place: students.avatar_url,
--     units.thumbnail_url, knowledge_uploads.thumbnail_url.
--
-- DEPLOY ORDER: this migration MUST be applied AFTER the matching code
-- ships (the proxy at /api/storage and the buildStorageProxyUrl helper)
-- so existing public URLs continue to work until both sides cut over
-- atomically.
--
-- OUT OF SCOPE (deferred, tracked as FU-SEC-RESPONSES-PATH-MIGRATION):
--   URLs embedded in student_progress.responses JSONB. Those are opaque
--   text inside JSON values; rewriting them safely needs a separate
--   migration with content scanning. Until then, those embedded URLs
--   (rendered inside student responses uploaded BEFORE this migration)
--   will return 404 after the bucket flip — but new uploads from this
--   point forward use the proxy URL and work end-to-end.
--
-- ROLLBACK: paired .down.sql reverses bucket privacy + restores legacy
-- URLs. RLS policies are NOT recreated — the original public-read
-- policies (if any) get dropped here and the down migration leaves the
-- bucket in `public = true` state which is sufficient for legacy access.

BEGIN;

-- ─── Step 1: flip the buckets to private ───────────────────────────────

UPDATE storage.buckets
SET public = false
WHERE id IN ('responses', 'unit-images', 'knowledge-media');

-- ─── Step 2: drop any pre-existing public-read RLS policies ────────────
-- service_role BYPASSES RLS by design. The proxy at /api/storage uses
-- service_role to mint signed URLs; writers use service_role for uploads.
-- So no explicit RLS policies are needed — the deny-all-by-default
-- behaviour of an RLS-enabled table with no policies is exactly what we
-- want for these buckets. Document this in rls-deny-all.md follow-up.

DO $$
DECLARE
  bucket_name TEXT;
BEGIN
  FOR bucket_name IN SELECT unnest(ARRAY['responses', 'unit-images', 'knowledge-media'])
  LOOP
    -- Drop any policies named after the typical "public-read" patterns
    -- Supabase setup wizards create. Idempotent — IF EXISTS guards each.
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      bucket_name || '_public_read'
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      'Public Access ' || bucket_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      'Allow public read on ' || bucket_name
    );
  END LOOP;
END $$;

-- ─── Step 3: rewrite stored URL columns to /api/storage proxy URLs ─────

-- 3a. students.avatar_url — bucket "responses"
UPDATE students
SET avatar_url = regexp_replace(
  avatar_url,
  '^https?://[^/]+/storage/v1/object/(?:public|sign)/responses/(.+?)(\?.*)?$',
  '/api/storage/responses/\1'
)
WHERE avatar_url IS NOT NULL
  AND avatar_url ~ '/storage/v1/object/(?:public|sign)/responses/';

-- 3b. units.thumbnail_url — bucket "unit-images"
UPDATE units
SET thumbnail_url = regexp_replace(
  thumbnail_url,
  '^https?://[^/]+/storage/v1/object/(?:public|sign)/unit-images/(.+?)(\?.*)?$',
  '/api/storage/unit-images/\1'
)
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url ~ '/storage/v1/object/(?:public|sign)/unit-images/';

-- 3c. knowledge_uploads.thumbnail_url — bucket "knowledge-media"
-- Wrapped in DO block so the migration is safe on environments where
-- the column doesn't exist (e.g. earlier branches).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'knowledge_uploads' AND column_name = 'thumbnail_url'
  ) THEN
    EXECUTE $sql$
      UPDATE knowledge_uploads
      SET thumbnail_url = regexp_replace(
        thumbnail_url,
        '^https?://[^/]+/storage/v1/object/(?:public|sign)/knowledge-media/(.+?)(\?.*)?$',
        '/api/storage/knowledge-media/\1'
      )
      WHERE thumbnail_url IS NOT NULL
        AND thumbnail_url ~ '/storage/v1/object/(?:public|sign)/knowledge-media/'
    $sql$;
  END IF;
END $$;

COMMIT;
