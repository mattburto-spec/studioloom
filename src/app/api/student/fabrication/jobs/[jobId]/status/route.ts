/**
 * GET /api/student/fabrication/jobs/[jobId]/status
 *
 * Preflight Phase 4-2. Returns denormalised status payload for the
 * student's polling state machine (Phase 4-5). Mints a fresh 10-min
 * signed thumbnail URL on each call — not persisted — so bucket
 * misconfigurations can't leak paths.
 *
 * Auth: student cookie-token session; verifies the student owns the jobId.
 * Cache: private, no-cache (Lesson #11 — polled endpoint, must not
 *        hit any CDN cache even though no cookies are set).
 *
 * Response shape on success (200):
 *   {
 *     jobId, jobStatus, currentRevision,
 *     revision: { id, revisionNumber, scanStatus, scanError,
 *                 scanCompletedAt, scanRulesetVersion, thumbnailUrl } | null,
 *     scanJob: { id, status, attemptCount, errorDetail } | null
 *   }
 *
 * Error statuses:
 *   401 unauthenticated student
 *   404 job not found OR not owned
 *   500 DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJobStatus, isOrchestrationError } from "@/lib/fabrication/orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json(
      { error: "jobId required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await getJobStatus(db, { studentId: auth.studentId, jobId });

  if (isOrchestrationError(result)) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
