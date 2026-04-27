import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { resolveStudentSettings } from "@/lib/student-support/resolve-settings";

/**
 * GET /api/student/me/support-settings?classId=<uuid>
 *
 * Phase 2.5 — returns the resolved support settings for the current
 * authenticated student, optionally scoped to a class. The hook
 * `useStudentSupportSettings(classId?)` calls this once per page-session
 * and uses the result to gate UI rendering (e.g. TappableText skips
 * wrapping words when tapAWordEnabled is false).
 *
 * Response shape:
 *   { l1Target, tapAWordEnabled, l1Source, tapASource }
 *
 * Server is the source of truth — UI gating is a UX optimisation, the
 * actual `/api/student/word-lookup` route also enforces tapAWordEnabled
 * server-side and returns { disabled: true } if the student is gated.
 */

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const classId = request.nextUrl.searchParams.get("classId") || undefined;
  // Defensive: ignore non-UUID-looking values
  const safeClassId =
    classId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)
      ? classId
      : undefined;

  const resolved = await resolveStudentSettings(auth.studentId, safeClassId);

  return NextResponse.json(resolved, { headers: CACHE_HEADERS });
}
