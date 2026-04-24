import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";

/* ──────────────────────────────────────────────────────────────
 * /api/teacher/student-projects
 *
 * Read + upsert per-student PYPX Exhibition project records. One row
 * per (student × class × unit). Migration 111 created the table.
 *
 * GET returns one entry per enrolled student — existing student_projects
 * rows are merged with empty placeholders for students who don't have
 * a project yet, so the UI can render a full roster.
 * ────────────────────────────────────────────────────────────── */

type ProjectPhase = "wonder" | "findout" | "make" | "share" | "reflect";

export interface StudentProject {
  id: string | null;
  student_id: string;
  student_display_name: string;
  class_id: string;
  unit_id: string;
  title: string | null;
  central_idea: string | null;
  lines_of_inquiry: string[] | null;
  transdisciplinary_theme: string | null;
  mentor_teacher_id: string | null;
  current_phase: ProjectPhase | null;
  updated_at: string | null;
}

const VALID_PHASES: ReadonlySet<string> = new Set([
  "wonder",
  "findout",
  "make",
  "share",
  "reflect",
]);

// ─────────────────────────────────────────────────────────────
// GET /api/teacher/student-projects?classId=…&unitId=…
// → { projects: StudentProject[] } (one per enrolled student, including
//   placeholder rows for students without a saved project yet)
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const unitId = url.searchParams.get("unitId");
  if (!classId || !unitId) {
    return NextResponse.json(
      { error: "classId + unitId required" },
      { status: 400 },
    );
  }

  const owns = await verifyTeacherOwnsClass(auth.teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();

  // Parallel: enrolled students + existing project rows.
  const [studentsRes, projectsRes] = await Promise.all([
    db
      .from("class_students")
      .select("student_id, students(id, username, display_name)")
      .eq("class_id", classId)
      .eq("is_active", true),
    db
      .from("student_projects")
      .select(
        "id, student_id, class_id, unit_id, title, central_idea, lines_of_inquiry, transdisciplinary_theme, mentor_teacher_id, current_phase, updated_at",
      )
      .eq("class_id", classId)
      .eq("unit_id", unitId),
  ]);

  if (studentsRes.error) {
    console.error("[teacher/student-projects GET students]", studentsRes.error);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
  if (projectsRes.error) {
    console.error(
      "[teacher/student-projects GET projects]",
      projectsRes.error,
    );
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }

  // Index saved projects by student_id for the merge.
  const byStudent = new Map<
    string,
    (typeof projectsRes.data)[number]
  >();
  for (const p of projectsRes.data ?? []) byStudent.set(p.student_id, p);

  const projects: StudentProject[] = (studentsRes.data ?? [])
    .filter((row: { students: unknown }) => row.students)
    .map((row: { student_id: string; students: unknown }) => {
      // students is a nested object, not an array in the PostgREST shape
      // we request. Cast conservatively.
      const s = row.students as {
        id: string;
        username: string;
        display_name: string | null;
      };
      const existing = byStudent.get(s.id);
      return {
        id: existing?.id ?? null,
        student_id: s.id,
        student_display_name: s.display_name || s.username,
        class_id: classId,
        unit_id: unitId,
        title: existing?.title ?? null,
        central_idea: existing?.central_idea ?? null,
        lines_of_inquiry: existing?.lines_of_inquiry ?? null,
        transdisciplinary_theme: existing?.transdisciplinary_theme ?? null,
        mentor_teacher_id: existing?.mentor_teacher_id ?? null,
        current_phase:
          (existing?.current_phase as ProjectPhase | null) ?? null,
        updated_at: existing?.updated_at ?? null,
      };
    });

  // Stable sort by student display name so the roster doesn't shuffle.
  projects.sort((a, b) =>
    a.student_display_name.localeCompare(b.student_display_name),
  );

  return NextResponse.json({ projects });
}

// ─────────────────────────────────────────────────────────────
// POST /api/teacher/student-projects
// body: { studentId, classId, unitId, title?, central_idea?,
//         lines_of_inquiry?, transdisciplinary_theme?,
//         mentor_teacher_id?, current_phase? }
//
// Upserts on (student_id, class_id, unit_id). Partial payloads merge
// with existing fields (only keys present in the body update;
// explicit null clears).
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  let body: {
    studentId?: string;
    classId?: string;
    unitId?: string;
    title?: string | null;
    central_idea?: string | null;
    lines_of_inquiry?: string[] | null;
    transdisciplinary_theme?: string | null;
    mentor_teacher_id?: string | null;
    current_phase?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { studentId, classId, unitId } = body;
  if (!studentId || !classId || !unitId) {
    return NextResponse.json(
      { error: "studentId + classId + unitId required" },
      { status: 400 },
    );
  }

  const owns = await verifyTeacherOwnsClass(auth.teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    "current_phase" in body &&
    body.current_phase != null &&
    !VALID_PHASES.has(body.current_phase)
  ) {
    return NextResponse.json(
      { error: "current_phase must be wonder|findout|make|share|reflect" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Load existing to merge partials.
  const { data: existing } = await db
    .from("student_projects")
    .select("*")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .maybeSingle();

  const merged: Record<string, unknown> = {
    student_id: studentId,
    class_id: classId,
    unit_id: unitId,
    // Preserve existing fields, then override with keys present in body.
    title: existing?.title ?? null,
    central_idea: existing?.central_idea ?? null,
    lines_of_inquiry: existing?.lines_of_inquiry ?? null,
    transdisciplinary_theme: existing?.transdisciplinary_theme ?? null,
    mentor_teacher_id: existing?.mentor_teacher_id ?? null,
    current_phase: existing?.current_phase ?? null,
  };
  if ("title" in body) merged.title = body.title;
  if ("central_idea" in body) merged.central_idea = body.central_idea;
  if ("lines_of_inquiry" in body) merged.lines_of_inquiry = body.lines_of_inquiry;
  if ("transdisciplinary_theme" in body) {
    merged.transdisciplinary_theme = body.transdisciplinary_theme;
  }
  if ("mentor_teacher_id" in body) {
    merged.mentor_teacher_id = body.mentor_teacher_id;
  }
  if ("current_phase" in body) merged.current_phase = body.current_phase;

  const { data: upserted, error: upsertErr } = await db
    .from("student_projects")
    .upsert(merged, { onConflict: "student_id,class_id,unit_id" })
    .select(
      "id, student_id, class_id, unit_id, title, central_idea, lines_of_inquiry, transdisciplinary_theme, mentor_teacher_id, current_phase, updated_at",
    )
    .single();

  if (upsertErr) {
    console.error("[teacher/student-projects POST]", upsertErr);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  return NextResponse.json({ project: upserted });
}
