// audit-skip: routine fab-tech operational endpoint, audit lives in fabrication pipeline state machine
/**
 * POST /api/fab/jobs/[jobId]/assign-machine
 *
 * Phase 8.1d-22. Fabricator assigns a category-only job
 * (machine_profile_id IS NULL) to a specific machine. Backs the
 * dashboard's "Send to →" menu — picks one of the lab's printers
 * or lasers and locks the job to it.
 *
 * Body: { machineProfileId: string }
 * Auth: fabricator cookie-token session.
 * Cache: private, no-store.
 *
 * Response 200: { jobId, machineProfileId, machineLabel }
 * Errors:
 *   400 — missing/invalid machineProfileId
 *   401 — no/inactive fab session
 *   404 — job or machine not found / not owned by inviting teacher
 *   409 — job not in 'approved' status, OR machine in different lab
 *         / category from the job
 *   500 — DB failure
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFabricatorAuth } from "@/lib/fab/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignMachine } from "@/lib/fabrication/fab-orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
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

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  const b = body as Record<string, unknown>;
  if (typeof b.machineProfileId !== "string" || !UUID_RE.test(b.machineProfileId)) {
    return NextResponse.json(
      { error: "machineProfileId must be a UUID" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const db = createAdminClient();
  const result = await assignMachine(db, {
    fabricatorId: auth.fabricator.id,
    jobId,
    machineProfileId: b.machineProfileId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(result, {
    status: 200,
    headers: NO_CACHE_HEADERS,
  });
}
