// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * PATCH /api/teacher/fabrication/classes/[classId]/default-lab
 *
 * Phase 8.1d-3 (PH8-FU-CLASS-LAB-ASSIGN). Sets the
 * `classes.default_lab_id` for one class. Body:
 *   { defaultLabId: string }   — assign to this lab
 *   { defaultLabId: null }     — clear the assignment (legacy fallback;
 *                                 student picker will show all machines)
 *
 * Phase 8-3 (revised 28 Apr — audit MED-3 fold-in): ownership flipped
 * from teacher-scoped to school-scoped. Any teacher at the school
 * can set the default lab for any class at the school. Cross-school
 * access → 404 (no existence leak). Class teacher_id is still kept
 * on classes (legacy column from mig 001) but is no longer the
 * access-control axis.
 *
 * Auth: teacher Supabase Auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";
import {
  loadTeacherSchoolId,
  loadSchoolOwnedLab,
  isOrchestrationError,
} from "@/lib/fabrication/lab-orchestration";
import { requireTeacher } from "@/lib/auth/require-teacher";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

interface PatchBody {
  defaultLabId?: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { classId } = await params;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  if (
    body.defaultLabId !== null &&
    typeof body.defaultLabId !== "string"
  ) {
    return privateJson(
      { error: "`defaultLabId` must be a lab UUID string or null." },
      400
    );
  }

  const admin = createAdminClient();

  // Phase 8-3 audit MED-3 fold-in: resolve calling teacher's school first.
  const schoolResult = await loadTeacherSchoolId(admin, teacherId);
  if (isOrchestrationError(schoolResult)) {
    return privateJson(
      { error: schoolResult.error.message },
      schoolResult.error.status
    );
  }
  const schoolId = schoolResult.schoolId;

  // School-scoped ownership check on the class. We still need the
  // class's teacher_id to know who created it, but access is gated
  // by school membership (flat — any teacher at the school can edit
  // any class at the school).
  //
  // classes.teacher_id → teachers.school_id chain mirrors the
  // class-loading pattern used elsewhere. No `default_lab_id` join
  // here — that's what we're about to update.
  const classResult = await admin
    .from("classes")
    .select("id, teacher_id, teachers!inner(school_id)")
    .eq("id", classId)
    .maybeSingle();
  if (classResult.error) {
    return privateJson(
      { error: `Class lookup failed: ${classResult.error.message}` },
      500
    );
  }
  // PostgREST embed shape: `teachers` is either an object or an array
  // depending on the FK direction. classes.teacher_id is single-FK
  // → object. Defensive: handle either shape.
  const classTeachers = classResult.data?.teachers as
    | { school_id: string | null }
    | { school_id: string | null }[]
    | undefined;
  const classSchoolId = Array.isArray(classTeachers)
    ? classTeachers[0]?.school_id
    : classTeachers?.school_id;
  if (!classResult.data || classSchoolId !== schoolId) {
    return privateJson({ error: "Class not found." }, 404);
  }

  // If a lab is being set, school-scoped ownership-check it via the
  // shared helper from lab-orchestration.
  if (typeof body.defaultLabId === "string") {
    const labResult = await loadSchoolOwnedLab(
      admin,
      schoolId,
      body.defaultLabId
    );
    if (isOrchestrationError(labResult)) {
      return privateJson(
        { error: labResult.error.message },
        labResult.error.status
      );
    }
  }

  // Apply the update. Drop the `.eq("teacher_id", user.id)` legacy
  // belt — we already verified school membership above, and any
  // teacher at the school can edit the class.
  const update = await admin
    .from("classes")
    .update({ default_lab_id: body.defaultLabId })
    .eq("id", classId);
  if (update.error) {
    return privateJson(
      { error: `Class update failed: ${update.error.message}` },
      500
    );
  }

  return privateJson({
    classId,
    defaultLabId: body.defaultLabId,
  });
}
