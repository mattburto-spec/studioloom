// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/labs/[id]/bulk-approval
 *
 * The "lab-level approval toggle" Matt asked for at the 8-2 pre-flight
 * conversation. One click on the lab admin UI flips
 * `requires_teacher_approval` for every active teacher-owned machine
 * in the lab. Per-machine override still works afterward (the toggle
 * is a shortcut, not a permanent override — `auto_approves_all`
 * column was deliberately NOT added to fabrication_labs to avoid
 * denormalization).
 *
 * Body: { requireApproval: boolean }
 * Returns: { labId, updatedMachineCount, requireApproval }
 *
 * Preflight Phase 8-3.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  bulkSetApprovalForLab,
  isOrchestrationError,
} from "@/lib/fabrication/machine-orchestration";
import { requireTeacher } from "@/lib/auth/require-teacher";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

interface BulkApprovalBody {
  requireApproval?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { id: labId } = await params;

  let body: BulkApprovalBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.requireApproval !== "boolean") {
    return privateJson(
      { error: "`requireApproval` must be a boolean." },
      400
    );
  }

  const admin = createAdminClient();
  const result = await bulkSetApprovalForLab(admin, {
    teacherId,
    labId,
    requireApproval: body.requireApproval,
  });

  if (isOrchestrationError(result)) {
    return privateJson({ error: result.error.message }, result.error.status);
  }
  return privateJson(result);
}
