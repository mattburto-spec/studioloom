/**
 * GET /api/fab/jobs/[jobId]/download-preview
 *
 * Phase 8.1d-27. Read-only download for inspection — streams the
 * file without flipping status. Fab tech wants to look at the
 * file in their slicer before committing to running it.
 *
 * Difference vs. /download:
 *   - /download         = pickup + stream (status: approved → picked_up)
 *   - /download-preview = stream only     (status unchanged)
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-store.
 *
 * Response 200: binary file bytes with Content-Disposition that
 *   tags the filename `(preview)` so the lab tech doesn't confuse
 *   the inspection copy with their committed-pickup downloads.
 *
 * Errors:
 *   400 invalid jobId
 *   401 no/inactive fab session
 *   404 job not visible to this fab (same scope as queue list)
 *   409 file no longer in storage (retention-pruned, or never
 *       uploaded — rare)
 *   500 storage / DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFabJobDetail } from "@/lib/fabrication/fab-orchestration";
import { FABRICATION_UPLOAD_BUCKET } from "@/lib/fabrication/orchestration";
import { buildFabricationDownloadFilename } from "@/lib/fabrication/download-filename";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (!jobId || typeof jobId !== "string" || !UUID_RE.test(jobId)) {
    return jsonError("jobId must be a UUID", 400);
  }

  const db = createAdminClient();

  // Same visibility check as /download — getFabJobDetail validates
  // the fab can see this job (owned by inviting teacher, or
  // already picked up by them). Reuse so the access contract
  // stays in one place.
  const detail = await getFabJobDetail(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
  });
  if ("error" in detail) {
    return jsonError(detail.error.message, detail.error.status);
  }

  if (!detail.currentRevisionData) {
    return jsonError("No revision found for this job", 404);
  }

  const storagePath = detail.currentRevisionData.storagePath;
  if (!storagePath) {
    return jsonError(
      "File no longer in storage — may have been retention-pruned",
      409
    );
  }

  // Same filename helper as /download, with a (preview) tag so the
  // lab tech can tell at a glance which copy is the inspection
  // download vs. the committed pickup.
  const baseFilename = buildFabricationDownloadFilename({
    studentName: detail.student.name,
    gradeLevel: detail.classInfo?.name ?? null,
    unitTitle: detail.unit?.title ?? null,
    originalFilename: detail.job.originalFilename,
    submittedAt: detail.job.createdAt,
  });
  // Insert "-preview" before the extension so it sorts cleanly
  // alongside the committed copy in the lab tech's downloads dir.
  const downloadFilename = baseFilename.replace(
    /(\.[^.]+)$/,
    "-preview$1"
  );

  const bucketDownload = await db.storage
    .from(FABRICATION_UPLOAD_BUCKET)
    .download(storagePath);
  if (bucketDownload.error || !bucketDownload.data) {
    const msg = bucketDownload.error?.message ?? "Storage download failed";
    return jsonError(`Couldn't read the file from storage: ${msg}`, 500);
  }

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
