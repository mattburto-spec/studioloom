import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { resolveStudentSettings } from "@/lib/student-support/resolve-settings";
import { resolveStudentClassId } from "@/lib/student-support/resolve-class-id";

/**
 * GET /api/student/me/support-settings?classId=<uuid>&unitId=<uuid>
 *
 * Phase 2.5 — returns the resolved support settings for the current
 * authenticated student, optionally scoped to a class. The hook
 * `useStudentSupportSettings(classId?)` calls this once per page-session
 * and uses the result to gate UI rendering (e.g. TappableText skips
 * wrapping words when tapAWordEnabled is false).
 *
 * Bug 2: also accepts ?unitId — server derives the (verified) classId via
 * class_units × class_students so lesson pages can pass unitId without
 * having to know the classId themselves. classId wins when both are sent.
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

  const rawClassId = request.nextUrl.searchParams.get("classId") || undefined;
  const rawUnitId = request.nextUrl.searchParams.get("unitId") || undefined;

  // Bug 2: server-derive classId from (classId | unitId). resolveStudentClassId
  // verifies enrollment + handles UUID validation defensively.
  const classId = await resolveStudentClassId({
    studentId: auth.studentId,
    classId: rawClassId,
    unitId: rawUnitId,
  });

  const resolved = await resolveStudentSettings(auth.studentId, classId);

  return NextResponse.json(resolved, { headers: CACHE_HEADERS });
}
