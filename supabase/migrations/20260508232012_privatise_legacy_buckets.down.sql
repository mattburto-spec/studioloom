-- Rollback for: privatise_legacy_buckets
-- Pairs with: 20260508232012_privatise_legacy_buckets.sql
--
-- Reverses the up-migration in 3 steps:
--   1. URL columns rewritten back from /api/storage proxy shape to the
--      legacy public Supabase URL shape. Requires SUPABASE_PROJECT_REF
--      to be set as a server GUC OR substituted via psql -v before run.
--      This rollback ASSUMES production project ref —
--      `cxxbfmnbwihuskaaltlk` — per docs/feature-flags.yaml. Update if
--      running against a different environment.
--   2. Buckets flipped back to public.
--   3. RLS policies are NOT recreated — public buckets don't need them.

BEGIN;

-- Step 1: rewrite proxy URLs back to legacy public Supabase URLs.
-- We only restore rows whose URL currently matches the proxy shape; rows
-- that have a fresh URL written by post-rollback uploads stay untouched.

DO $$
DECLARE
  project_url TEXT := 'https://cxxbfmnbwihuskaaltlk.supabase.co';
BEGIN
  UPDATE students
  SET avatar_url = regexp_replace(
    avatar_url,
    '^/api/storage/responses/(.+)$',
    project_url || '/storage/v1/object/public/responses/\1'
  )
  WHERE avatar_url IS NOT NULL
    AND avatar_url LIKE '/api/storage/responses/%';

  UPDATE units
  SET thumbnail_url = regexp_replace(
    thumbnail_url,
    '^/api/storage/unit-images/(.+)$',
    project_url || '/storage/v1/object/public/unit-images/\1'
  )
  WHERE thumbnail_url IS NOT NULL
    AND thumbnail_url LIKE '/api/storage/unit-images/%';

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'knowledge_uploads' AND column_name = 'thumbnail_url'
  ) THEN
    EXECUTE $sql$
      UPDATE knowledge_uploads
      SET thumbnail_url = regexp_replace(
        thumbnail_url,
        '^/api/storage/knowledge-media/(.+)$',
        $1 || '/storage/v1/object/public/knowledge-media/\1'
      )
      WHERE thumbnail_url IS NOT NULL
        AND thumbnail_url LIKE '/api/storage/knowledge-media/%'
    $sql$
    USING project_url;
  END IF;
END $$;

-- Step 2: flip the buckets back to public.

UPDATE storage.buckets
SET public = true
WHERE id IN ('responses', 'unit-images', 'knowledge-media');

COMMIT;
