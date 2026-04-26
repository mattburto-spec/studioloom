/**
 * GET /api/fab/jobs/[jobId]/download
 *
 * Phase 7-2. The lab-tech download handler. Does three things in
 * one round-trip from the fabricator's POV:
 *   1. Fetches job detail (for the filename: student + class + unit)
 *   2. Calls pickupJob (transitions approved → picked_up; idempotent
 *      on re-download by the same fabricator)
 *   3. Streams file bytes from Supabase Storage with
 *      Content-Disposition: attachment; filename="..." using
 *      buildFabricationDownloadFilename (Phase 6-6k).
 *
 * Why stream bytes (vs. a signed-URL redirect)? We need to control
 * Content-Disposition so the file saves as
 * `matt-burton-10-design-coaster.svg` not `<uuid>/v1.svg`. A signed
 * URL surfaces the raw storage path to the browser, so the
 * auto-rename wouldn't work. Serverless bandwidth cost is
 * negligible for a DT-lab file (1–50 MB) and the download is a
 * single user action, not a hot path.
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-store (force re-download every time).
 *
 * Response 200: binary file bytes with Content-Disposition.
 * Errors: 401, 404 (not assigned / not found), 409 (race lost or
 * already picked up by someone else), 500 (storage / DB failure).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFabJobDetail,
  pickupJob,
} from "@/lib/fabrication/fab-orchestration";
import { FABRICATION_UPLOAD_BUCKET } from "@/lib/fabrication/orchestration";
import { buildFabricationDownloadFilename } from "@/lib/fabrication/download-filename";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: NO_CACHE_HEADERS }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireFabricatorAuth(request);
  if ("error" in auth) return auth.error;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string") {
    return jsonError("jobId required", 400);
  }

  const db = createAdminClient();

  // 1. Fetch detail — gives us the filename context + proves the
  // fabricator is allowed to download this job. If detail returns
  // 404, the pickup would also 404; fail fast here.
  const detail = await getFabJobDetail(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
  });
  if ("error" in detail) {
    return jsonError(detail.error.message, detail.error.status);
  }

  // 2. Transition to picked_up (or no-op if already picked up by
  // this fabricator). Returns the storage_path for the current
  // revision's file.
  const pickup = await pickupJob(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
  });
  if ("error" in pickup) {
    return jsonError(pickup.error.message, pickup.error.status);
  }

  // 3. Stream file bytes from Storage.
  const downloadFilename = buildFabricationDownloadFilename({
    studentName: detail.student.name,
    // Class name stands in for grade level in v1 (the class name
    // usually contains the grade, e.g. "10 Design"). Phase 9 can
    // add a separate grade_level field to the filename helper if
    // teachers want a different split.
    gradeLevel: detail.classInfo?.name ?? null,
    unitTitle: detail.unit?.title ?? null,
    originalFilename: detail.job.originalFilename,
    // Phase 8.1d-19: stamp the submission time onto the filename so
    // re-submissions of the same student/class/unit don't overwrite
    // each other in the lab tech's downloads folder.
    submittedAt: detail.job.createdAt,
  });

  const bucketDownload = await db.storage
    .from(FABRICATION_UPLOAD_BUCKET)
    .download(pickup.storagePath);
  if (bucketDownload.error || !bucketDownload.data) {
    const msg = bucketDownload.error?.message ?? "Storage download failed";
    return jsonError(`Couldn't read the file from storage: ${msg}`, 500);
  }

  // Convert the Blob from Supabase SDK to bytes we can stream back.
  const arrayBuffer = await bucketDownload.data.arrayBuffer();
  const contentType =
    detail.job.fileType === "svg" ? "image/svg+xml" : "model/stl";

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(arrayBuffer.byteLength),
      "Content-Disposition": `attachment; filename="${downloadFilename}"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
