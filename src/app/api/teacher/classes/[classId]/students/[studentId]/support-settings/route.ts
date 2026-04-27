import { NextRequest, NextResponse } from "next/server";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSupportSettings } from "@/lib/student-support/types";
import { resolveStudentSettings } from "@/lib/student-support/resolve-settings";

/**
 * Phase 2.5 — single-student per-class support-settings endpoint.
 *
 *   PATCH /api/teacher/classes/[classId]/students/[studentId]/support-settings
 *     → updates class_students.support_settings (per-class override) for
 *       this one student. Body: partial { l1_target_override?, tap_a_word_enabled? }.
 *       Merges with existing — sending just one field doesn't wipe others.
 *       Returns the resolved settings after the merge.
 */

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  const { classId, studentId } = await params;
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const owns = await verifyTeacherOwnsClass(teacherId, classId);
  if (!owns) {
    return NextResponse.json(
      { error: "Forbidden — not your class" },
      { status: 403, headers: CACHE_HEADERS }
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const incoming = parseSupportSettings(body);
  if (Object.keys(incoming).length === 0) {
    return NextResponse.json(
      { error: "body must contain at least one valid override field" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const supabase = createAdminClient();

  // Verify student is enrolled in this class + fetch existing to merge
  const { data: existing, error: fetchErr } = await supabase
    .from("class_students")
    .select("support_settings")
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json(
      { error: "Failed to load enrollment", details: fetchErr.message },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Student not enrolled in this class" },
      { status: 404, headers: CACHE_HEADERS }
    );
  }

  const merged = { ...parseSupportSettings(existing.support_settings), ...incoming };

  const { error: updateErr } = await supabase
    .from("class_students")
    .update({ support_settings: merged })
    .eq("class_id", classId)
    .eq("student_id", studentId);

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to update settings", details: updateErr.message },
      { status: 500, headers: CACHE_HEADERS }
    );
  }

  // Return the resolved settings post-merge so the UI can update without re-fetching the full list
  const resolved = await resolveStudentSettings(studentId, classId);

  return NextResponse.json(
    {
      ok: true,
      classSupportSettings: merged,
      resolved,
    },
    { headers: CACHE_HEADERS }
  );
}
