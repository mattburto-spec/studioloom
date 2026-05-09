// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * PATCH /api/teacher/labs/[id]/machines
 *
 * Reassign a machine from this lab (URL-scoped for namespace clarity)
 * to a target lab (body). Both labs must be at the calling teacher's
 * school; cross-school reassignment → 404 (revised 28 Apr).
 *
 * Body: { machineProfileId: string, toLabId: string }
 *
 * Preflight Phase 8-2 (revised 28 Apr).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  reassignMachineToLab,
  isOrchestrationError,
} from "@/lib/fabrication/lab-orchestration";
import { requireTeacher } from "@/lib/auth/require-teacher";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

interface ReassignBody {
  machineProfileId?: unknown;
  // Renamed from `targetLabId` to `toLabId` 28 Apr to match the
  // orchestration's `fromLabId`/`toLabId` semantics. No external
  // callers existed, so renaming is non-breaking.
  toLabId?: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { id: fromLabId } = await params;

  let body: ReassignBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.machineProfileId !== "string" || !body.machineProfileId) {
    return privateJson(
      { error: "`machineProfileId` is required (string)." },
      400
    );
  }
  if (typeof body.toLabId !== "string" || !body.toLabId) {
    return privateJson(
      { error: "`toLabId` is required (string)." },
      400
    );
  }

  const admin = createAdminClient();
  const result = await reassignMachineToLab(admin, {
    teacherId,
    fromLabId,
    machineProfileId: body.machineProfileId,
    toLabId: body.toLabId,
  });

  if (isOrchestrationError(result)) {
    return privateJson(
      { error: result.error.message },
      result.error.status
    );
  }
  return privateJson(result);
}
