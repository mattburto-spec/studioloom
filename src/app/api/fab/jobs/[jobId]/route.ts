/**
 * GET    /api/fab/jobs/[jobId]   — single-job detail (Phase 7-2)
 * DELETE /api/fab/jobs/[jobId]   — permanent purge (Phase 8.1d-31)
 *
 * GET visibility: fabricator must be CURRENTLY assigned to the
 * job's machine, OR they must be the one who picked it up (§11 Q8
 * allows access-after-unassignment for own picked-up jobs).
 *
 * DELETE visibility: same scope as /unassign — must belong to the
 * fab's inviting teacher. No status gate; works on approved,
 * picked_up, completed alike. Cascades through revisions + scan
 * jobs and best-effort wipes Storage bytes.
 *
 * Auth: fabricator cookie-token session.
 * Cache: private, no-store.
 *
 * Response 200 (GET): FabJobDetail (see fab-orchestration.ts)
 * Response 200 (DELETE): { jobId }
 * Errors: 400 invalid id, 401, 404 (not found OR not accessible), 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFabJobDetail, deleteJob } from "@/lib/fabrication/fab-orchestration";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireFabricatorAuth(request);
  if ("error" in auth) return auth.error;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json(
      { error: "jobId required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await getFabJobDetail(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, { status: 200, headers: NO_CACHE_HEADERS });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireFabricatorAuth(request);
  if ("error" in auth) return auth.error;

  const { jobId } = await context.params;
  if (!jobId || typeof jobId !== "string" || !UUID_RE.test(jobId)) {
    return NextResponse.json(
      { error: "jobId must be a UUID" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await deleteJob(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  // Storage warnings logged but not surfaced to the client — DB
  // row is gone so the UI's correct outcome is "job disappeared."
  if (result.storageWarnings.length > 0) {
    console.warn(
      `[fab/jobs/${jobId}/DELETE] storage cleanup warnings:`,
      result.storageWarnings
    );
  }

  return NextResponse.json(
    { jobId: result.jobId },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
