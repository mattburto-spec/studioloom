import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** Auth-only client — used solely to verify teacher identity via cookies */
function getAuthClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

/** Verify teacher auth, return user or error response */
async function verifyTeacher(request: NextRequest) {
  const supabase = getAuthClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, error: null };
}

export async function GET(request: NextRequest) {
  const { user, error: authErr } = await verifyTeacher(request);
  if (authErr) return authErr;

  const db = createAdminClient();

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
  const { data: classData } = await db
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user!.id)
    .single();

  if (!classData) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Get all students in the class with their Open Studio status
  const { data: students } = await db
    .from("students")
    .select("id, username, display_name, avatar_url, ell_level")
    .eq("class_id", classId);

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
}

export async function POST(request: NextRequest) {
  const { user, error: authErr } = await verifyTeacher(request);
  if (authErr) return authErr;

  const db = createAdminClient();

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
  const { data: classData } = await db
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user!.id)
    .single();

  if (!classData) {
    console.error("[open-studio] Class not found for teacher:", user!.id, "class:", classId);
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Verify student belongs to this class
  const { data: student } = await db
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("class_id", classId)
    .single();

  if (!student) {
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
}

export async function PATCH(request: NextRequest) {
  const { user, error: authErr } = await verifyTeacher(request);
  if (authErr) return authErr;

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
  if (!classInfo || classInfo.teacher_id !== user!.id) {
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
}
