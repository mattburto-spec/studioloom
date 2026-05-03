// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import {
  requireTeacherAuth,
  verifyTeacherCanManageStudent,
} from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseSupportSettings,
  mergeSupportSettingsForWrite,
} from "@/lib/student-support/types";
import { resolveStudentSettings } from "@/lib/student-support/resolve-settings";
import { mapLanguageToCode } from "@/lib/tap-a-word/language-mapping";

/**
 * Per-student unified support-settings endpoint (Option A — single source
 * of truth for one student across global + every class they're in).
 *
 *   GET   /api/teacher/students/[studentId]/support-settings
 *     → returns:
 *         {
 *           student: {
 *             id, displayName, username, ellLevel,
 *             intake: { firstLanguageRaw, intakeL1Code },
 *             globalSupportSettings: <raw JSONB>,
 *             resolvedGlobal: ResolvedSupportSettings  // no class context
 *           },
 *           classes: [
 *             {
 *               classId, className, classCode, framework,
 *               classOverrides: <raw JSONB>,
 *               resolved: ResolvedSupportSettings
 *             },
 *             ...
 *           ]
 *         }
 *
 *   PATCH /api/teacher/students/[studentId]/support-settings
 *     → updates students.support_settings (per-student global). Body:
 *       { l1_target_override?, tap_a_word_enabled? }. Merges via
 *       mergeSupportSettingsForWrite (Bug 3 — explicit null deletes the key).
 *       Returns the same shape as GET so the UI can refresh in one round-trip.
 *
 * Auth: any teacher who currently owns at least one of the student's active
 * non-archived classes can manage their settings (verifyTeacherCanManageStudent).
 *
 * For per-class overrides (the Phase 2.5 scope), the existing endpoints
 * /api/teacher/classes/[classId]/students/[studentId]/support-settings (single)
 * and /api/teacher/classes/[classId]/students/support-settings (bulk) are
 * unchanged. This new endpoint only writes the per-STUDENT layer.
 */

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };

interface ClassRow {
  id: string;
  name: string;
  code: string;
  framework: string | null;
  is_archived: boolean | null;
}

async function buildResponse(studentId: string) {
  const supabase = createAdminClient();

  // Student row. ell_level is on a dedicated column (not in support_settings
  // JSONB) but follows the same per-student/per-class cascade pattern, so we
  // surface it here too — single source of truth for support-related settings.
  const { data: student } = await supabase
    .from("students")
    .select("id, display_name, username, ell_level, learning_profile, support_settings")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return null;
  }

  // Intake-derived L1 (mirrors resolveStudentSettings's intake branch).
  const lp = (student.learning_profile ?? {}) as { languages_at_home?: unknown };
  const firstLanguageRaw =
    Array.isArray(lp.languages_at_home) && typeof lp.languages_at_home[0] === "string"
      ? (lp.languages_at_home[0] as string)
      : null;
  const intakeL1Code = firstLanguageRaw ? mapLanguageToCode(firstLanguageRaw) : null;

  // Global resolved (no class context — falls through global → intake → default).
  const resolvedGlobal = await resolveStudentSettings(studentId);

  // Active enrollments in non-archived classes only (matches the resolver's
  // filter). Returns the student's actually-current classes.
  const { data: enrollmentRows } = await supabase
    .from("class_students")
    .select(
      "class_id, support_settings, ell_level_override, classes!inner(id, name, code, framework, is_archived)"
    )
    .eq("student_id", studentId)
    .eq("is_active", true)
    .order("enrolled_at", { ascending: false });

  type EnrollmentRow = {
    class_id: string;
    support_settings: unknown;
    ell_level_override: number | null;
    classes: ClassRow | ClassRow[] | null;
  };
  const liveEnrollments = ((enrollmentRows ?? []) as EnrollmentRow[]).filter((e) => {
    const c = Array.isArray(e.classes) ? e.classes[0] : e.classes;
    return c && !c.is_archived;
  });

  // Resolve per-class — sequential, fine for ~5-10 classes.
  const classes = await Promise.all(
    liveEnrollments.map(async (e) => {
      const c = (Array.isArray(e.classes) ? e.classes[0] : e.classes) as ClassRow;
      const resolved = await resolveStudentSettings(studentId, c.id);
      // ELL resolution mirrors the JSONB cascade: per-class override (if set)
      // wins, else falls back to the student's global ell_level. No "intake"
      // layer for ELL — it's teacher-set, not student-set.
      const resolvedEll = e.ell_level_override ?? student.ell_level ?? null;
      const ellSource: "class-override" | "student-global" | "default" =
        e.ell_level_override != null
          ? "class-override"
          : student.ell_level != null
            ? "student-global"
            : "default";
      return {
        classId: c.id,
        className: c.name,
        classCode: c.code,
        framework: c.framework,
        classOverrides: parseSupportSettings(e.support_settings),
        ellLevelOverride: e.ell_level_override,
        resolved,
        resolvedEll,
        ellSource,
      };
    })
  );

  return {
    student: {
      id: student.id,
      displayName: student.display_name,
      username: student.username,
      ellLevel: student.ell_level,
      intake: {
        firstLanguageRaw,
        intakeL1Code,
      },
      globalSupportSettings: parseSupportSettings(student.support_settings),
      resolvedGlobal,
    },
    classes,
  };
}

// ─── GET ────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const allowed = await verifyTeacherCanManageStudent(auth.teacherId, studentId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden — you don't share any class with this student" },
      { status: 403, headers: CACHE_HEADERS }
    );
  }

  const body = await buildResponse(studentId);
  if (!body) {
    return NextResponse.json(
      { error: "Student not found" },
      { status: 404, headers: CACHE_HEADERS }
    );
  }

  return NextResponse.json(body, { headers: CACHE_HEADERS });
}

// ─── PATCH (per-student global) ─────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const allowed = await verifyTeacherCanManageStudent(auth.teacherId, studentId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden — you don't share any class with this student" },
      { status: 403, headers: CACHE_HEADERS }
    );
  }

  let raw: { ell_level?: unknown; [k: string]: unknown } = {};
  try {
    raw = (await request.json()) as { ell_level?: unknown; [k: string]: unknown };
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  // Two parallel writes: support_settings JSONB (l1 + tap-a-word) AND the
  // dedicated students.ell_level column. Body can include either or both.
  const incoming = parseSupportSettings(raw);

  // ell_level: number 1-3 sets the global, null is meaningless here (the
  // students table requires a value). Caller should pass a number to change
  // it; omit the field to leave unchanged.
  let ellLevelToWrite: number | undefined;
  if (raw.ell_level !== undefined) {
    if (
      typeof raw.ell_level === "number" &&
      Number.isInteger(raw.ell_level) &&
      raw.ell_level >= 1 &&
      raw.ell_level <= 3
    ) {
      ellLevelToWrite = raw.ell_level;
    } else {
      return NextResponse.json(
        { error: "ell_level must be 1, 2, or 3" },
        { status: 400, headers: CACHE_HEADERS }
      );
    }
  }

  if (Object.keys(incoming).length === 0 && ellLevelToWrite === undefined) {
    return NextResponse.json(
      { error: "body must contain at least one valid field (l1_target_override, tap_a_word_enabled, or ell_level)" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("students")
    .select("support_settings")
    .eq("id", studentId)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json(
      { error: "Failed to load student", details: fetchErr.message },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Student not found" },
      { status: 404, headers: CACHE_HEADERS }
    );
  }

  // Build the partial UPDATE payload. Only include fields the caller set —
  // avoids accidentally clobbering values when the caller only wanted to
  // change one thing.
  const updatePayload: Record<string, unknown> = {};
  if (Object.keys(incoming).length > 0) {
    // Bug 3 semantics — null in `incoming` deletes the key, doesn't persist null.
    updatePayload.support_settings = mergeSupportSettingsForWrite(
      existing.support_settings,
      incoming
    );
  }
  if (ellLevelToWrite !== undefined) {
    updatePayload.ell_level = ellLevelToWrite;
  }

  const { error: updateErr } = await supabase
    .from("students")
    .update(updatePayload)
    .eq("id", studentId);
  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to update settings", details: updateErr.message },
      { status: 500, headers: CACHE_HEADERS }
    );
  }

  // Return the full updated shape so the UI can refresh in one round-trip.
  const body = await buildResponse(studentId);
  return NextResponse.json(body, { headers: CACHE_HEADERS });
}
