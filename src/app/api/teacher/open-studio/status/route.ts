import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth, verifyTeacherOwnsClass } from "@/lib/auth/verify-teacher-unit";

/**
 * Teacher Open Studio Status API
 *
 * GET  /api/teacher/open-studio/status?unitId={id}&classId={id}
 *   → List all students' Open Studio status for a unit+class.
 *
 * POST /api/teacher/open-studio/status
 *   → Grant Open Studio to a student (teacher unlock).
 *   Body: { studentId, unitId, classId, teacherNote?, carryForward? }
 *
 * PATCH /api/teacher/open-studio/status
 *   → Revoke Open Studio or update settings.
 *   Body: { statusId, action: "revoke" | "update", reason?, carryForward? }
 */

export const GET = withErrorHandler("teacher/open-studio/status:GET", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");
  const classId = searchParams.get("classId");

  if (!unitId || !classId) {
    return NextResponse.json(
      { error: "unitId and classId are required" },
      { status: 400 }
    );
  }

  // Verify teacher owns this class
  const ownsClass = await verifyTeacherOwnsClass(teacherId, classId);
  if (!ownsClass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Get all students in the class — try junction table first, fallback to legacy class_id
  let students: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; ell_level: number }> | null = null;

  // Strategy 1: class_students junction table (post-migration 041)
  try {
    const { data: junctionRows } = await db
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId);

    if (junctionRows && junctionRows.length > 0) {
      const studentIds = junctionRows.map((r) => r.student_id);
      const { data } = await db
        .from("students")
        .select("id, username, display_name, avatar_url, ell_level")
        .in("id", studentIds);
      students = data;
    }
  } catch {
    // Junction table may not exist yet
  }

  // Strategy 2: legacy students.class_id fallback
  if (!students || students.length === 0) {
    const { data } = await db
      .from("students")
      .select("id, username, display_name, avatar_url, ell_level")
      .eq("class_id", classId);
    students = data;
  }

  const { data: statuses } = await db
    .from("open_studio_status")
    .select("*")
    .eq("unit_id", unitId)
    .eq("class_id", classId);

  // Merge students with their status
  const statusMap = new Map(
    (statuses || []).map((s) => [s.student_id, s])
  );

  const result = (students || []).map((student) => ({
    student,
    openStudio: statusMap.get(student.id) || null,
  }));

  return NextResponse.json({ students: result });
});

export const POST = withErrorHandler("teacher/open-studio/status:POST", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const body = await request.json();
  const {
    studentId,
    unitId,
    classId,
    teacherNote,
    carryForward = false,
  } = body as {
    studentId: string;
    unitId: string;
    classId: string;
    teacherNote?: string;
    carryForward?: boolean;
  };

  if (!studentId || !unitId || !classId) {
    return NextResponse.json(
      { error: "studentId, unitId, and classId are required" },
      { status: 400 }
    );
  }

  // Verify teacher owns this class
  const ownsClass = await verifyTeacherOwnsClass(teacherId, classId);
  if (!ownsClass) {
    console.error("[open-studio] Class not found for teacher:", teacherId, "class:", classId);
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Verify student belongs to this class (junction table first, legacy fallback)
  let studentVerified = false;
  try {
    const { data: junctionRow } = await db
      .from("class_students")
      .select("student_id")
      .eq("student_id", studentId)
      .eq("class_id", classId)
      .maybeSingle();
    if (junctionRow) studentVerified = true;
  } catch {
    // Junction table may not exist
  }
  if (!studentVerified) {
    const { data: legacyStudent } = await db
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("class_id", classId)
      .maybeSingle();
    if (legacyStudent) studentVerified = true;
  }

  if (!studentVerified) {
    console.error("[open-studio] Student not in class:", studentId, "class:", classId);
    return NextResponse.json({ error: "Student not found in class" }, { status: 404 });
  }

  // Upsert Open Studio status (unlock)
  const { data: status, error } = await db
    .from("open_studio_status")
    .upsert(
      {
        student_id: studentId,
        unit_id: unitId,
        class_id: classId,
        status: "unlocked",
        unlocked_by: "teacher",
        teacher_note: teacherNote || null,
        check_in_interval_min: 15,
        carry_forward: carryForward,
        unlocked_at: new Date().toISOString(),
        revoked_at: null,
        revoked_reason: null,
      },
      { onConflict: "student_id,unit_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[open-studio] Grant error:", error.message, error.details, error.hint);
    return NextResponse.json(
      { error: "Failed to grant Open Studio", details: error.message },
      { status: 500 }
    );
  }

  console.log("[open-studio] Granted Open Studio:", status.id, "student:", studentId, "unit:", unitId);
  return NextResponse.json({ status });
});

export const PATCH = withErrorHandler("teacher/open-studio/status:PATCH", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const db = createAdminClient();

  const body = await request.json();
  const {
    statusId,
    action,
    reason,
    carryForward,
  } = body as {
    statusId: string;
    action: "revoke" | "update";
    reason?: string;
    carryForward?: boolean;
  };

  if (!statusId || !action) {
    return NextResponse.json(
      { error: "statusId and action are required" },
      { status: 400 }
    );
  }

  // Verify teacher owns the class associated with this status
  const { data: existing } = await db
    .from("open_studio_status")
    .select("*, classes!inner(teacher_id)")
    .eq("id", statusId)
    .single();

  if (!existing || (existing as Record<string, unknown>).classes === null) {
    return NextResponse.json({ error: "Status not found" }, { status: 404 });
  }

  // Verify the authenticated teacher owns this class
  const classInfo = (existing as Record<string, unknown>).classes as { teacher_id: string } | null;
  if (!classInfo || classInfo.teacher_id !== teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (action === "revoke") {
    const { data: updated, error } = await db
      .from("open_studio_status")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: reason || "teacher_manual",
      })
      .eq("id", statusId)
      .select("*")
      .single();

    if (error) {
      console.error("[open-studio] Revoke error:", error.message);
      return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
    }
    return NextResponse.json({ status: updated });
  }

  if (action === "update") {
    const updates: Record<string, unknown> = {};
    if (carryForward !== undefined) {
      updates.carry_forward = carryForward;
    }

    const { data: updated, error } = await db
      .from("open_studio_status")
      .update(updates)
      .eq("id", statusId)
      .select("*")
      .single();

    if (error) {
      console.error("[open-studio] Update error:", error.message);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
    return NextResponse.json({ status: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
});
