// audit-skip: storage proxy — auth-gate + 302 to signed URL, no state mutation
/**
 * Storage proxy endpoint (security-plan.md P-3).
 *
 * Replaces the legacy public-URL pattern for the `responses`, `unit-images`,
 * and `knowledge-media` buckets. Pre-fix, those buckets used getPublicUrl()
 * which produced URL-guessable paths (`{studentId}/{unitId}/{pageId}/
 * {timestamp}.{ext}`) — anyone who knew or guessed a student UUID could
 * iterate file names and pull student photos.
 *
 * After privatisation:
 *   1. Buckets flipped to `public = false` + service-role-only RLS on
 *      storage.objects (see migration 20260508232012).
 *   2. URLs stored in DB rewritten to point at this proxy:
 *        before: https://xxx.supabase.co/storage/v1/object/public/responses/X/Y.jpg
 *        after:  /api/storage/responses/X/Y.jpg
 *   3. This route auth-checks the request, mints a fresh signed URL (5min
 *      TTL) via service-role, and 302-redirects to it.
 *
 * Auth model (hardened 9 May 2026 after Gemini external review caught the
 * IDOR — all 3 buckets used to allow "any authenticated user" which let
 * Student A read Student B's avatar via /api/storage/responses/{StudentB_UUID}/...
 * because the proxy uses service-role to mint, bypassing RLS):
 *
 *   - responses: per-student authorization. Student must own the path's
 *     {studentId}/... first segment. Teachers must verifyTeacherCanManageStudent.
 *     Platform admins read all.
 *   - unit-images / knowledge-media: any authenticated user (these are
 *     curriculum thumbnails + teaching materials, not student PII). Future
 *     scoping tracked as FU-SEC-{UNIT-IMAGES,KNOWLEDGE-MEDIA}-SCOPING.
 *
 * See ./authorize.ts for the full rule table.
 *
 * Cache-Control:
 *   - The proxy redirect is `private, max-age=240` (4min) — slightly under
 *     the 5min signed-URL TTL so the browser refreshes before the URL
 *     expires. Tradeoff: bursty image grids re-mint at most once per 4min,
 *     not per render.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeBucketAccess } from "./authorize";

const ALLOWED_BUCKETS = new Set(["responses", "unit-images", "knowledge-media"]);
const SIGNED_URL_TTL_SECONDS = 300; // 5 min — caller refreshes via repeat hit
const PROXY_CACHE_SECONDS = 240; // 4 min — refresh before TTL expires

type RouteContext = { params: Promise<{ bucket: string; path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { bucket, path: pathSegments } = await context.params;

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
  }

  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  // Auth gate: any authenticated Supabase user.
  // Per-bucket authorization (e.g. class-membership for `responses`)
  // tracked as a P-3 follow-up.
  const supabaseSsr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          _cookies: { name: string; value: string; options?: CookieOptions }[],
        ) {
          // Read-only — no cookie mutations from a media proxy.
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabaseSsr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Path comes from the URL — Next.js [...path] catch-all already
  // path-decodes each segment.
  const fullPath = pathSegments.map(decodeURIComponent).join("/");

  // Per-bucket authorization. Closes the IDOR surface: pre-fix, any
  // authenticated user could read any path. See ./authorize.ts.
  const authz = await authorizeBucketAccess(user, bucket, fullPath);
  if (!authz.ok) {
    // 403 (not 404) so we don't help an attacker probe whether a path
    // exists. The 401-vs-403-vs-404 split: 401 = no session, 403 = wrong
    // user / malformed path, 404 = file genuinely missing.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(fullPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    // 404 (not 500) — file genuinely not present, OR an existing signed
    // URL won't help anyway. Don't leak signing-error detail to client.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set(
    "Cache-Control",
    `private, max-age=${PROXY_CACHE_SECONDS}, must-revalidate`,
  );
  return response;
}
