/**
 * POST /api/student/fabrication/jobs/[jobId]/cancel
 *
 * Phase 6-6k. Student-side withdraw — transitions the job to
 * `cancelled` when the status is still student-reversible (not yet
 * approved / rejected / picked_up / completed).
 *
 * Auth: student cookie-token session; verifies ownership.
 * Cache: private, no-store.
 *
 * Response 200: { jobId, newStatus: 'cancelled' }
 * Errors:
 *   401 unauthenticated
 *   404 job not found OR not owned
 *   409 status no longer cancellable (teacher has already acted)
 *   500 DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelJob, isOrchestrationError } from "@/lib/fabrication/orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function POST(
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
  const result = await cancelJob(db, { studentId: auth.studentId, jobId });

  if (isOrchestrationError(result)) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}
