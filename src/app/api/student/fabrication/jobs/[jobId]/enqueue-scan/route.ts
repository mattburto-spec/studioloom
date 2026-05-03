/**
 * POST /api/student/fabrication/jobs/[jobId]/enqueue-scan
 *
 * Preflight Phase 4-2. Idempotent — re-calling with an already-pending or
 * already-running scan_job returns the existing row. Schema-enforced via
 * uq_fabrication_scan_jobs_active_per_revision (migration 096).
 *
 * Called by the client after the signed-URL PUT completes (Phase 4-4).
 *
 * Auth: student cookie-token session; verifies the student owns the jobId.
 * Cache: private, no-cache (Lesson #11).
 *
 * Response shape on success (200):
 *   { scanJobId, status, attemptCount, isNew, jobRevisionId }
 *
 * Error statuses:
 *   401 unauthenticated student
 *   404 job not found OR not owned (indistinguishable to client by design)
 *   500 DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueScanJob, isOrchestrationError } from "@/lib/fabrication/orchestration";

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
  const result = await enqueueScanJob(db, { studentId: session.studentId, jobId });

  if (isOrchestrationError(result)) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      scanJobId: result.scanJobId,
      status: result.status,
      attemptCount: result.attemptCount,
      isNew: result.isNew,
      jobRevisionId: result.jobRevisionId,
    },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
