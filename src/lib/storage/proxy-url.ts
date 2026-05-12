/**
 * Storage proxy URL helper (security-plan.md P-3).
 *
 * Replaces direct getPublicUrl(...) calls. Returns a relative URL pointing at
 * the auth-gated proxy at /api/storage/[bucket]/[...path] (see
 * src/app/api/storage/[bucket]/[...path]/route.ts).
 *
 * Storing relative URLs in DB has two benefits:
 * 1. Environment-portable — same row works in dev / preview / prod.
 * 2. Resilient to Supabase project URL changes.
 *
 * Path segments are URL-encoded individually so paths containing spaces /
 * unicode work correctly. The `/` separators are preserved.
 */

const PROXY_PREFIX = "/api/storage";
const ALLOWED_BUCKETS = new Set([
  "responses",
  "unit-images",
  "knowledge-media",
  // v2 Project Spec — User Profile slot 7 photos (PR #194). Same per-
  // student auth pattern as `responses` — see authorize.ts.
  "user-profile-photos",
]);

/**
 * Build a proxy URL from a bucket name and storage path.
 *
 * Example:
 *   buildStorageProxyUrl("responses", "abc/avatar/img.jpg")
 *   → "/api/storage/responses/abc/avatar/img.jpg"
 */
export function buildStorageProxyUrl(bucket: string, path: string): string {
  if (!ALLOWED_BUCKETS.has(bucket)) {
    throw new Error(
      `buildStorageProxyUrl: bucket "${bucket}" not in allowlist. ` +
        `Add to ALLOWED_BUCKETS in src/lib/storage/proxy-url.ts AND in ` +
        `the proxy route handler if this is a new private bucket.`,
    );
  }
  // Encode each segment but preserve the `/` separators.
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${PROXY_PREFIX}/${bucket}/${encoded}`;
}

/**
 * Inverse of buildStorageProxyUrl — extract bucket + path from a proxy URL,
 * OR from a legacy Supabase public URL. Returns null if neither shape matches.
 *
 * Used by the URL-rewrite migration backfill to convert legacy
 * `https://xxx.supabase.co/storage/v1/object/public/{bucket}/{path}` to
 * proxy URLs in-place.
 */
export function parseStorageUrl(
  url: string,
): { bucket: string; path: string } | null {
  if (!url) return null;

  // Proxy shape: /api/storage/{bucket}/{path...}
  if (url.startsWith(PROXY_PREFIX + "/")) {
    const rest = url.slice(PROXY_PREFIX.length + 1);
    const slash = rest.indexOf("/");
    if (slash === -1) return null;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    if (!ALLOWED_BUCKETS.has(bucket)) return null;
    return { bucket, path: decodePath(path) };
  }

  // Legacy public URL: https://*.supabase.co/storage/v1/object/public/{bucket}/{path}
  const legacyMatch = url.match(
    /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/,
  );
  if (legacyMatch) {
    const bucket = legacyMatch[1];
    const path = legacyMatch[2];
    if (!ALLOWED_BUCKETS.has(bucket)) return null;
    return { bucket, path: decodePath(path) };
  }

  return null;
}

function decodePath(p: string): string {
  return p
    .split("/")
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    })
    .join("/");
}
