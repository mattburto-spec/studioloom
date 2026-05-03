import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";

/**
 * DELETE /api/teacher/class-students
 * Remove a student from a class.
 *
 * Body: { studentId: string; classId: string }
 *
 * This does three things:
 * 1. Sets class_students.is_active = false (soft delete)
 * 2. Invalidates all active sessions for that student if no other enrollments (forces logout)
 * 3. Returns success
 *
 * Why invalidate sessions: Without this, a removed student keeps a valid
 * 7-day session token and can continue using the Design Assistant, view
 * cached pages, etc. Immediate session invalidation ensures clean removal.
 */
export async function DELETE(request: NextRequest) {
  // Teacher auth via Supabase Auth
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const body = await request.json();
  const { studentId, classId } = body as {
    studentId: string;
    classId: string;
  };

  if (!studentId || !classId) {
    return NextResponse.json(
      { error: "studentId and classId are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Phase 6.2 — gate via can()-backed shim. Opens up co_teacher /
  // dept_head capability + collapses the dual teacher_id/author_teacher_id
  // dance into one resolved check.
  const owns = await verifyTeacherOwnsClass(teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // 1. Soft-remove from class_students
  const { error: removeError } = await supabase
    .from("class_students")
    .update({ is_active: false })
    .eq("student_id", studentId)
    .eq("class_id", classId);

  if (removeError) {
    console.error("[class-students] Remove error:", removeError);
    return NextResponse.json(
      { error: "Failed to remove student" },
      { status: 500 }
    );
  }

  // 2. Check if student has ANY remaining active enrollments
  const { data: remainingEnrollments } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true);

  // Also check legacy class_id
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .single();

  const hasLegacyClass = student?.class_id && student.class_id !== classId;
  const hasActiveEnrollments =
    (remainingEnrollments && remainingEnrollments.length > 0) || hasLegacyClass;

  // Phase 6.1 — student_sessions table dropped. Forced sign-out is now
  // handled by Supabase Auth: deleting the auth.users row (or revoking
  // refresh tokens via supabase.auth.admin.signOut) is the equivalent.
  // For "removed from last class" we do NOT auto-revoke the auth session —
  // the student may still need to access their portfolio. The
  // `class_students` removal already gates classroom data; auth stays.

  return NextResponse.json({
    success: true,
    sessionsInvalidated: false,
  });
}
