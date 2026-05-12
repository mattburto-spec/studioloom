// audit-skip: FU-PLATFORM-CUSTOM-PROJECT-PITCH MVP. Teacher pitch
// decisions are pedagogical actions in the room (Matt's pilot) — not
// security-sensitive in the audit-log sense. Real audit logging tracked
// as a tightening FU once the workflow proves out.
//
// Teacher pitch-decision endpoint for the "Other / Pitch your own"
// archetype workflow (FU-PLATFORM-CUSTOM-PROJECT-PITCH MVP).
//
// Auth model: teacher must manage the student (Access v2 via
// verifyTeacherCanManageStudent). Service-role admin client mints the
// write — no RLS path needed.
//
// State transitions:
//   pending | revise → approved   (student unblocked, can write slots)
//   pending | revise → revise     (asks for changes; teacher note required)
//   pending | revise → rejected   (also clears archetype_id so student
//                                  returns to the picker to pick a preset)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { verifyTeacherCanManageStudent } from "@/lib/auth/verify-teacher-unit";

export const POST = withErrorHandler(
  "teacher/product-brief-pitch:POST",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "body must be an object" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    if (typeof b.studentId !== "string" || b.studentId.length === 0) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 });
    }
    if (typeof b.unitId !== "string" || b.unitId.length === 0) {
      return NextResponse.json({ error: "unitId required" }, { status: 400 });
    }
    if (b.action !== "approve" && b.action !== "revise" && b.action !== "reject") {
      return NextResponse.json(
        { error: "action must be 'approve' | 'revise' | 'reject'" },
        { status: 400 },
      );
    }
    const studentId = b.studentId;
    const unitId = b.unitId;
    const action = b.action;
    const note =
      typeof b.note === "string" && b.note.trim().length > 0 ? b.note.trim() : null;

    // Authz: teacher must manage this student.
    const canManage = await verifyTeacherCanManageStudent(teacherId, studentId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = createAdminClient();

    // Read current row to validate the transition.
    const { data: current, error: readErr } = await db
      .from("student_unit_product_briefs")
      .select("pitch_status, archetype_id")
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json(
        { error: "No product brief for this student + unit" },
        { status: 404 },
      );
    }
    const currentStatus = (current.pitch_status as string | null) ?? null;
    if (currentStatus !== "pending" && currentStatus !== "revise") {
      return NextResponse.json(
        {
          error: `Cannot decide on a pitch with status '${currentStatus ?? "null"}'. Only pending or revise can transition.`,
        },
        { status: 409 },
      );
    }

    // Map action → next status + side effects.
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      pitch_decided_at: nowIso,
      pitch_decided_by: teacherId,
    };

    if (action === "approve") {
      patch.pitch_status = "approved";
      patch.pitch_teacher_note = note; // Optional kudos / context
    } else if (action === "revise") {
      patch.pitch_status = "revise";
      if (!note) {
        return NextResponse.json(
          { error: "note required when requesting revision" },
          { status: 400 },
        );
      }
      patch.pitch_teacher_note = note;
    } else {
      // reject — also clears archetype so student returns to the picker.
      // Pitch text + note preserved as evidence of the decision.
      patch.pitch_status = "rejected";
      patch.pitch_teacher_note = note;
      patch.archetype_id = null;
    }

    const { data, error } = await db
      .from("student_unit_product_briefs")
      .update(patch)
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .select(
        "pitch_status, pitch_teacher_note, pitch_decided_at, pitch_decided_by, archetype_id",
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save decision" },
        { status: 500 },
      );
    }

    return NextResponse.json({ pitch: data });
  },
);

/**
 * GET /api/teacher/product-brief-pitch?status=pending
 *
 * Returns pending+revise pitches across all students the teacher
 * manages. Drives the /teacher/pitches review queue page.
 */
export const GET = withErrorHandler(
  "teacher/product-brief-pitch:GET",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    const db = createAdminClient();

    // Get all classes this teacher manages.
    const { data: classes } = await db
      .from("classes")
      .select("id, name")
      .eq("teacher_id", teacherId);
    const classIds = (classes ?? []).map((c) => c.id as string);
    if (classIds.length === 0) {
      return NextResponse.json({ pitches: [] });
    }

    // Find students enrolled in these classes.
    const { data: enrollments } = await db
      .from("class_students")
      .select("student_id, class_id")
      .in("class_id", classIds)
      .eq("is_active", true);
    const studentIds = Array.from(
      new Set((enrollments ?? []).map((e) => e.student_id as string)),
    );
    if (studentIds.length === 0) {
      return NextResponse.json({ pitches: [] });
    }

    // Read pending + revise pitches for these students.
    const { data: pitches } = await db
      .from("student_unit_product_briefs")
      .select(
        "student_id, unit_id, pitch_text, pitch_status, pitch_teacher_note, created_at, updated_at",
      )
      .in("pitch_status", ["pending", "revise"])
      .in("student_id", studentIds)
      .order("updated_at", { ascending: false });

    if (!pitches || pitches.length === 0) {
      return NextResponse.json({ pitches: [] });
    }

    // Enrich with student + unit display names.
    const pitchStudentIds = Array.from(new Set(pitches.map((p) => p.student_id as string)));
    const pitchUnitIds = Array.from(new Set(pitches.map((p) => p.unit_id as string)));

    const [{ data: students }, { data: units }] = await Promise.all([
      db
        .from("students")
        .select("id, display_name, username")
        .in("id", pitchStudentIds),
      db.from("units").select("id, title").in("id", pitchUnitIds),
    ]);

    const studentMap = new Map(
      (students ?? []).map((s) => [
        s.id as string,
        { name: (s.display_name as string) || (s.username as string) || "Student" },
      ]),
    );
    const unitMap = new Map(
      (units ?? []).map((u) => [u.id as string, (u.title as string) || "Unit"]),
    );

    return NextResponse.json({
      pitches: pitches.map((p) => ({
        studentId: p.student_id,
        studentName: studentMap.get(p.student_id as string)?.name ?? "Student",
        unitId: p.unit_id,
        unitTitle: unitMap.get(p.unit_id as string) ?? "Unit",
        pitchText: p.pitch_text,
        pitchStatus: p.pitch_status,
        pitchTeacherNote: p.pitch_teacher_note,
        updatedAt: p.updated_at,
      })),
    });
  },
);
