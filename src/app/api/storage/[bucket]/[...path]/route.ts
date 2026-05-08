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
 * Auth model:
 *   - All 3 buckets require an authenticated Supabase session (any user
 *     type — teacher OR student).
 *   - Future hardening (P-3 follow-up): per-bucket authorization gates —
 *     `responses` should require class-membership when reading another
 *     student's path; `unit-images` could allow same-school teachers; etc.
 *     For now, "any logged-in user" is the gate. This is a strict upgrade
 *     over the prior "anyone with a guessed URL" state.
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

  // Mint a signed URL server-side via the service role.
  // Path comes from the URL — Next.js [...path] catch-all already
  // path-decodes each segment.
  const fullPath = pathSegments.map(decodeURIComponent).join("/");
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
