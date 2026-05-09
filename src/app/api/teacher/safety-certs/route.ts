// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherOwnsClass } from "@/lib/auth/verify-teacher-unit";
import { v4 as uuid } from "uuid";
import { requireTeacher } from "@/lib/auth/require-teacher";

/**
 * Teacher Safety Certifications API
 *
 * GET /api/teacher/safety-certs?classId={id}
 *   → Returns all certs for students in a class, grouped by student.
 *   Response: { certs: [{ id, student_id, cert_type, granted_at, expires_at, notes }] }
 *
 * POST /api/teacher/safety-certs
 *   → Grant a certification to a student.
 *   Body: { studentId, classId, certType, notes? }
 *
 * DELETE /api/teacher/safety-certs
 *   → Revoke a certification.
 *   Body: { studentId, certType }
 */

export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");

  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Phase 6.2 — gate via can()-backed shim.
  const owns = await verifyTeacherOwnsClass(teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const { data: certs, error } = await db
    .from("safety_certifications")
    .select("id, student_id, cert_type, granted_at, expires_at, notes")
    .eq("class_id", classId)
    .order("student_id")
    .order("cert_type");

  if (error) {
    console.error("[teacher/safety-certs] Error:", error);
    return NextResponse.json({ error: "Failed to load certs" }, { status: 500 });
  }

  return NextResponse.json({ certs: certs || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const body = await request.json();
  const { studentId, classId, certType, notes } = body;

  if (!studentId || !classId || !certType) {
    return NextResponse.json({ error: "studentId, classId, and certType are required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Phase 6.2 — gate via can()-backed shim.
  const owns = await verifyTeacherOwnsClass(teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Upsert the certification (idempotent — granting twice just updates)
  const { data: cert, error } = await db
    .from("safety_certifications")
    .upsert(
      {
        id: uuid(),
        student_id: studentId,
        class_id: classId,
        cert_type: certType,
        granted_by: teacherId,
        granted_at: new Date().toISOString(),
        notes: notes || null,
      },
      { onConflict: "student_id,cert_type" }
    )
    .select()
    .single();

  if (error) {
    console.error("[teacher/safety-certs] Grant error:", error);
    return NextResponse.json({ error: "Failed to grant certification" }, { status: 500 });
  }

  return NextResponse.json({ cert });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const body = await request.json();
  const { studentId, certType } = body;

  if (!studentId || !certType) {
    return NextResponse.json({ error: "studentId and certType are required" }, { status: 400 });
  }

  const db = createAdminClient();

  const { error } = await db
    .from("safety_certifications")
    .delete()
    .eq("student_id", studentId)
    .eq("cert_type", certType)
    .eq("granted_by", teacherId);

  if (error) {
    console.error("[teacher/safety-certs] Revoke error:", error);
    return NextResponse.json({ error: "Failed to revoke certification" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
