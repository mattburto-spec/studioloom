// audit-skip: routine learner activity, low audit value
/**
 * POST /api/student/fabrication/jobs/[jobId]/submit
 *
 * Preflight Phase 5-1. Final student action on a job — transitions
 * fabrication_jobs.status from 'uploaded' / 'scanning' / 'needs_revision'
 * to 'pending_approval' (if machine_profiles.requires_teacher_approval)
 * or 'approved' (if not).
 *
 * Validates, in order:
 *   1. Job is in a submittable state (guards double-submit races)
 *   2. Latest revision's scan_status is 'done'
 *   3. Zero BLOCK-severity rules in scan_results
 *   4. Every WARN-severity rule has an ack for the current revision
 *
 * Auth: student cookie-token session; verifies ownership.
 * Cache: private, no-cache.
 *
 * Response 200: { jobId, newStatus, requiresTeacherApproval }
 * Errors:
 *   400 scan not done / must-fix still firing / missing warning acks
 *   401 unauthenticated
 *   404 job not found OR not owned
 *   409 job already past submittable state (double-submit)
 *   500 DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitJob, isOrchestrationError } from "@/lib/fabrication/orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json(
      { error: "jobId required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await submitJob(db, {
    studentId: session.studentId,
    jobId,
  });

  if (isOrchestrationError(result)) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      jobId: result.jobId,
      newStatus: result.newStatus,
      requiresTeacherApproval: result.requiresTeacherApproval,
    },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
