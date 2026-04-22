/**
 * POST /api/student/fabrication/upload
 *
 * Preflight Phase 4-1. Student submits a machine profile + class + file
 * metadata; we create the job + revision rows, mint a Supabase Storage
 * signed-upload URL, and hand the URL back to the client for a direct PUT.
 *
 * Auth: student cookie-token session (requireStudentAuth).
 * Cache: private, no-cache (Lesson #11 — signed URLs must not be cached
 *        even by a CDN, even though no cookies are set on this response).
 *
 * Response shape on success (200):
 *   { jobId, revisionId, uploadUrl, storagePath }
 *
 * Error statuses:
 *   400 invalid body / extension mismatch / size invalid
 *   401 unauthenticated student
 *   403 student not enrolled in the provided classId
 *   404 machine_profile_id not found
 *   413 file exceeds 50 MB
 *   500 DB or Storage failure (with orphan row cleanup already done)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createUploadJob,
  isUploadJobError,
  validateUploadRequest,
} from "@/lib/fabrication/orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const validated = validateUploadRequest(body);
  if (isUploadJobError(validated as never)) {
    const e = (validated as { error: { status: number; message: string } }).error;
    return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_CACHE_HEADERS });
  }
  if (!("ok" in validated) || !validated.ok) {
    // Should be unreachable — isUploadJobError guards above — but keeps TS happy.
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await createUploadJob(db, {
    ...validated.data,
    studentId: auth.studentId,
  });

  if (isUploadJobError(result)) {
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
