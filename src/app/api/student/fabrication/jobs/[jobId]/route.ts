/**
 * DELETE /api/student/fabrication/jobs/[jobId]
 *
 * Phase 8.1d-32. Student-side permanent delete. Cascades the
 * fabrication_jobs row (revisions + scan_jobs via FK ON DELETE
 * CASCADE) and best-effort wipes the uploaded file + thumbnail
 * bytes from Storage. Mirrors the fab-side DELETE route
 * (`/api/fab/jobs/[jobId]`) but scoped to the student's own jobs.
 *
 * Distinct from POST /cancel:
 *   cancel — soft, status → 'cancelled', row preserved for audit
 *   delete — permanent, no undo, files gone
 *
 * Auth: student cookie-token session; verifies ownership.
 * Cache: private, no-store.
 *
 * Status gate (orchestration.ts:STUDENT_DELETABLE_STATUSES):
 *   allowed: uploaded / scanning / pending_approval / needs_revision
 *            / cancelled / rejected / completed
 *   blocked: approved (fab queue) / picked_up (being fabricated)
 *
 * Response 200: { jobId }
 * Errors:
 *   400 invalid jobId
 *   401 unauthenticated
 *   404 job not found OR not owned
 *   409 status not deletable (approved/picked_up)
 *   500 DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteStudentJob,
  isOrchestrationError,
} from "@/lib/fabrication/orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string" || !UUID_RE.test(jobId)) {
    return NextResponse.json(
      { error: "jobId must be a UUID" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await deleteStudentJob(db, {
    studentId: session.studentId,
    jobId,
  });

  if (isOrchestrationError(result)) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  // Storage warnings logged but not surfaced to the client — DB
  // row is gone so the UI's correct outcome is "job disappeared."
  if (result.storageWarnings.length > 0) {
    console.warn(
      `[student/fabrication/jobs/${jobId}/DELETE] storage cleanup warnings:`,
      result.storageWarnings
    );
  }

  return NextResponse.json(
    { jobId: result.jobId },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
