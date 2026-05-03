/**
 * POST /api/student/fabrication/jobs/[jobId]/revisions
 *
 * Preflight Phase 5-1. Student re-uploads a fixed version of a file for an
 * existing job. Creates revision N+1, mints a signed upload URL at the
 * revision's storage path, returns the same shape as Phase 4-1 `/upload`.
 *
 * The client (Phase 5-5 ReuploadModal) does the actual PUT to the signed
 * URL, then hits `/enqueue-scan` (Phase 4-2) to queue the worker.
 *
 * Auth: student cookie-token session; verifies ownership.
 * Cache: private, no-cache (Lesson #11).
 *
 * Response 200: { jobId, revisionId, uploadUrl, storagePath }
 * Errors:
 *   400 invalid body / extension mismatch / fileType mismatch with job
 *   401 unauthenticated
 *   404 job not found OR not owned
 *   413 file exceeds 50 MB
 *   500 DB or Storage failure (with cleanup)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createRevision,
  listRevisions,
  isOrchestrationError,
} from "@/lib/fabrication/orchestration";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be JSON object" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  const b = body as Record<string, unknown>;

  const db = createAdminClient();
  const result = await createRevision(db, {
    studentId: session.studentId,
    jobId,
    fileType: String(b.fileType ?? ""),
    originalFilename: String(b.originalFilename ?? ""),
    fileSizeBytes: typeof b.fileSizeBytes === "number" ? b.fileSizeBytes : NaN,
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
      revisionId: result.revisionId,
      uploadUrl: result.uploadUrl,
      storagePath: result.storagePath,
    },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}

/**
 * GET /api/student/fabrication/jobs/[jobId]/revisions
 *
 * Phase 5-5. Returns all revisions for a job, newest first, with
 * thumbnail signed URLs + rule-count summaries. Powers the
 * RevisionHistoryPanel on the status page.
 *
 * Response 200:
 *   { revisions: [{ id, revisionNumber, scanStatus, scanError,
 *                   scanCompletedAt, thumbnailUrl, ruleCounts,
 *                   createdAt }, ...] }
 * Errors: 401, 404 (job not found OR not owned), 500.
 */
export async function GET(
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

  // Phase 8.1d-11: wrap orchestration in try/catch so an unexpected
  // throw (Supabase client glitch, malformed signed-URL path, etc.)
  // returns a structured 500 with a logged message — the previous
  // raw-throw fell through to Next's default handler, which the
  // student page surfaces as "Loading your submission…" forever
  // because /revisions is fired in parallel with /status. The
  // status page treats a /revisions failure as soft (renders
  // revisionsError text) only when we return JSON.
  try {
    const db = createAdminClient();
    const result = await listRevisions(db, { studentId: session.studentId, jobId });

    if (isOrchestrationError(result)) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.status, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { revisions: result.revisions },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (e) {
    // Log enough context to trace which jobId + studentId blew up
    // without leaking to the response body.
    console.error(
      "[/api/student/fabrication/jobs/:jobId/revisions GET] unhandled error",
      { jobId, studentId: session.studentId, error: e }
    );
    return NextResponse.json(
      { error: "Couldn't load revision history. Please refresh." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
