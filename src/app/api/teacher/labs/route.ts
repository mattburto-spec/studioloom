// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * /api/teacher/labs
 *   GET  — list every lab at the calling teacher's school (flat
 *          membership — same list across all teachers at the same
 *          school)
 *   POST — create a new lab in the calling teacher's school
 *
 * Auth: teacher (Supabase Auth). All orchestration scoped by
 * `fabrication_labs.school_id = teacher.school_id` (revised 28 Apr
 * from teacher-scoped to school-scoped per Phase 8-1 Q3 flip + audit
 * Round 1 HIGH-2).
 *
 * Preflight Phase 8-2 (revised 28 Apr).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import { requireTeacher } from "@/lib/auth/require-teacher";
import {
  createLab,
  listMyLabs,
  isOrchestrationError,
} from "@/lib/fabrication/lab-orchestration";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

// -----------------------------------------------------------------
// GET — list this teacher's labs with machine counts
// -----------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const admin = createAdminClient();
  const result = await listMyLabs(admin, { teacherId });
  if (isOrchestrationError(result)) {
    return privateJson(
      { error: result.error.message },
      result.error.status
    );
  }
  return privateJson(result);
}

// -----------------------------------------------------------------
// POST — create a new lab
// -----------------------------------------------------------------

interface CreateLabBody {
  name?: unknown;
  description?: unknown;
  // Phase 8-2 (revised 28 Apr): isDefault dropped. Per-class
  // defaults live on `classes.default_lab_id`; per-teacher
  // preferences on `teachers.default_lab_id`. Labs themselves are
  // uniform — no flag.
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  let body: CreateLabBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const admin = createAdminClient();
  const result = await createLab(admin, {
    teacherId,
    name: typeof body.name === "string" ? body.name : "",
    description:
      typeof body.description === "string" || body.description === null
        ? body.description
        : undefined,
  });

  if (isOrchestrationError(result)) {
    return privateJson(
      { error: result.error.message },
      result.error.status
    );
  }

  return privateJson(result, 201);
}
