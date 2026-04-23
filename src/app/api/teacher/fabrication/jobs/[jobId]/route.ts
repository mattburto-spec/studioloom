/**
 * GET /api/teacher/fabrication/jobs/[jobId]
 *
 * Preflight Phase 6-2. Returns a full detail payload for the teacher's
 * per-submission review page. One response carries job meta + student/
 * class/unit/machine joins + current revision's scan results + full
 * revision history with thumbnails.
 *
 * Scoped to teacher ownership — 404 if the requesting teacher doesn't
 * own this job (same pattern as the 4 action endpoints).
 *
 * Auth: teacher Supabase Auth session.
 * Cache: private, no-cache.
 *
 * Response 200: TeacherJobDetailSuccess (see teacher-orchestration.ts)
 * Errors: 401, 404 (not found OR not owned), 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeacherJobDetail } from "@/lib/fabrication/teacher-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json(
      { error: "jobId required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await getTeacherJobDetail(db, { teacherId: auth.teacherId, jobId });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
