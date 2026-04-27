import { NextRequest, NextResponse } from "next/server";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSupportSettings } from "@/lib/student-support/types";
import { resolveStudentSettings } from "@/lib/student-support/resolve-settings";
import { mapLanguageToCode } from "@/lib/tap-a-word/language-mapping";

/**
 * Phase 2.5 — teacher support-settings endpoints (per-class, all students).
 *
 *   GET   /api/teacher/classes/[classId]/students/support-settings
 *     → list of students in the class with their current support settings
 *       (raw + resolved) + intake-derived L1 + ELL level. Used by the
 *       /teacher/classes/[classId]/students/support page to render the table.
 *
 *   PATCH /api/teacher/classes/[classId]/students/support-settings
 *     → bulk update. Body: { studentIds: string[], settings: { l1_target_override?, tap_a_word_enabled? } }
 *       Applies the partial settings to class_students.support_settings for each
 *       listed student in this class. Returns updated count + per-student results.
 *
 * Single-student updates live at the sibling path
 * /api/teacher/classes/[classId]/students/[studentId]/support-settings.
 */

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };

interface BulkPatchBody {
  studentIds?: unknown;
  settings?: unknown;
}

// ─── GET ────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
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

  const supabase = createAdminClient();

  // Fetch all students enrolled in this class (junction + student row + per-class override).
  // Note: students table uses `display_name` (nullable), not `name`. We map to `name` in the
  // response so the client doesn't need to know about this naming quirk.
  const { data: enrollments, error } = await supabase
    .from("class_students")
    .select(
      "student_id, support_settings, ell_level_override, students!inner(id, display_name, ell_level, learning_profile, support_settings)"
    )
    .eq("class_id", classId)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load enrollments", details: error.message },
      { status: 500, headers: CACHE_HEADERS }
    );
  }

  type EnrollmentRow = {
    student_id: string;
    support_settings: unknown;
    ell_level_override: number | null;
    students:
      | {
          id: string;
          display_name: string | null;
          ell_level: number;
          learning_profile: unknown;
          support_settings: unknown;
        }
      | Array<{
          id: string;
          display_name: string | null;
          ell_level: number;
          learning_profile: unknown;
          support_settings: unknown;
        }>;
  };

  const rows = (enrollments ?? []) as EnrollmentRow[];

  // Resolve per-student. resolveStudentSettings does its own queries — we
  // could optimise into a JOIN later if perf matters, but for test-class
  // scale (5–30 students) the ~2 queries-per-student is fine.
  const out = await Promise.all(
    rows.map(async (row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      if (!student) return null;
      const lp = (student.learning_profile ?? {}) as { languages_at_home?: unknown };
      const intakeFirst =
        Array.isArray(lp.languages_at_home) && typeof lp.languages_at_home[0] === "string"
          ? (lp.languages_at_home[0] as string)
          : null;
      const intakeL1Code = intakeFirst ? mapLanguageToCode(intakeFirst) : null;

      const resolved = await resolveStudentSettings(student.id, classId);

      return {
        studentId: student.id,
        // display_name is nullable — fall back to a friendly placeholder so the table
        // never shows "undefined" or empty cells. Real onboarding sets display_name.
        name: student.display_name || "(no name set)",
        ellLevel: row.ell_level_override ?? student.ell_level,
        ellLevelOverride: row.ell_level_override,
        intakeFirstLanguage: intakeFirst,
        intakeL1Code,
        studentSupportSettings: parseSupportSettings(student.support_settings),
        classSupportSettings: parseSupportSettings(row.support_settings),
        resolved,
      };
    })
  );

  return NextResponse.json(
    { students: out.filter(Boolean) },
    { headers: CACHE_HEADERS }
  );
}

// ─── PATCH (bulk) ──────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
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

  let body: BulkPatchBody | null = null;
  try {
    body = (await request.json()) as BulkPatchBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const studentIds = Array.isArray(body?.studentIds)
    ? (body.studentIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (studentIds.length === 0) {
    return NextResponse.json(
      { error: "studentIds must be a non-empty array of strings" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }
  if (studentIds.length > 200) {
    return NextResponse.json(
      { error: "studentIds limited to 200 per request" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const incoming = parseSupportSettings(body.settings);
  if (Object.keys(incoming).length === 0) {
    return NextResponse.json(
      { error: "settings must contain at least one valid override field" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const supabase = createAdminClient();

  // Fetch existing rows so we can MERGE rather than overwrite.
  const { data: existing, error: fetchErr } = await supabase
    .from("class_students")
    .select("student_id, support_settings")
    .eq("class_id", classId)
    .in("student_id", studentIds)
    .eq("is_active", true);

  if (fetchErr) {
    return NextResponse.json(
      { error: "Failed to load enrollments", details: fetchErr.message },
      { status: 500, headers: CACHE_HEADERS }
    );
  }

  const existingMap = new Map(
    (existing ?? []).map((r) => [r.student_id as string, r.support_settings])
  );

  // Per-student update — sequential keeps it simple + good enough at this scale.
  const results: Array<{ studentId: string; ok: boolean; error?: string }> = [];
  for (const sid of studentIds) {
    if (!existingMap.has(sid)) {
      results.push({ studentId: sid, ok: false, error: "not enrolled in class" });
      continue;
    }
    const merged = { ...parseSupportSettings(existingMap.get(sid)), ...incoming };
    const { error } = await supabase
      .from("class_students")
      .update({ support_settings: merged })
      .eq("class_id", classId)
      .eq("student_id", sid);
    if (error) {
      results.push({ studentId: sid, ok: false, error: error.message });
    } else {
      results.push({ studentId: sid, ok: true });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json(
    {
      updated: okCount,
      failed: results.length - okCount,
      results,
    },
    { headers: CACHE_HEADERS }
  );
}
