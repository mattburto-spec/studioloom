import { NextRequest, NextResponse } from "next/server";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSupportSettings, mergeSupportSettingsForWrite } from "@/lib/student-support/types";
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

  let body: { ell_level_override?: unknown; [k: string]: unknown } = {};
  try {
    body = (await request.json()) as { ell_level_override?: unknown; [k: string]: unknown };
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  // 28 Apr 2026: this endpoint now also accepts `ell_level_override` (number
  // 1-3, or null to clear). ELL override is on a dedicated column on
  // class_students, not in the support_settings JSONB, but it's a per-class
  // student-support setting, so it belongs here for UX consistency with the
  // unified Support tab.
  const incoming = parseSupportSettings(body);

  let ellOverrideToWrite: number | null | undefined;
  if (body.ell_level_override !== undefined) {
    if (body.ell_level_override === null) {
      ellOverrideToWrite = null;
    } else if (
      typeof body.ell_level_override === "number" &&
      Number.isInteger(body.ell_level_override) &&
      body.ell_level_override >= 1 &&
      body.ell_level_override <= 3
    ) {
      ellOverrideToWrite = body.ell_level_override;
    } else {
      return NextResponse.json(
        { error: "ell_level_override must be 1, 2, 3, or null" },
        { status: 400, headers: CACHE_HEADERS }
      );
    }
  }

  if (Object.keys(incoming).length === 0 && ellOverrideToWrite === undefined) {
    return NextResponse.json(
      { error: "body must contain at least one valid field (l1_target_override, tap_a_word_enabled, or ell_level_override)" },
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

  // Build a partial UPDATE — only include columns the caller actually set so
  // we never accidentally clobber a sibling value.
  const updatePayload: Record<string, unknown> = {};
  if (Object.keys(incoming).length > 0) {
    // Bug 3: explicit null in `incoming` deletes the JSONB key.
    updatePayload.support_settings = mergeSupportSettingsForWrite(
      existing.support_settings,
      incoming
    );
  }
  if (ellOverrideToWrite !== undefined) {
    updatePayload.ell_level_override = ellOverrideToWrite;
  }

  const { error: updateErr } = await supabase
    .from("class_students")
    .update(updatePayload)
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
      classSupportSettings:
        updatePayload.support_settings ?? parseSupportSettings(existing.support_settings),
      ellLevelOverride:
        ellOverrideToWrite !== undefined ? ellOverrideToWrite : undefined,
      resolved,
    },
    { headers: CACHE_HEADERS }
  );
}
