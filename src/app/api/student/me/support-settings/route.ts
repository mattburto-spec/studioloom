import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  // Phase 1.4b — explicit Supabase Auth via requireStudentSession.
  // Phase 1.4 CS-2 (30 Apr 2026) — RLS-respecting SSR client. Helpers
  // accept the supabase param so they read under the student's auth.uid()
  // chain (CS-1 policies + Phase 1.5/1.5b coverage on students +
  // class_students).
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const supabase = await createServerSupabaseClient();

  const rawClassId = request.nextUrl.searchParams.get("classId") || undefined;
  const rawUnitId = request.nextUrl.searchParams.get("unitId") || undefined;

  // Bug 2: server-derive classId from (classId | unitId). resolveStudentClassId
  // verifies enrollment + handles UUID validation defensively.
  const classId = await resolveStudentClassId({
    studentId: studentId,
    classId: rawClassId,
    unitId: rawUnitId,
    supabase,
  });

  const resolved = await resolveStudentSettings(studentId, classId, supabase);

  return NextResponse.json(resolved, { headers: CACHE_HEADERS });
}
