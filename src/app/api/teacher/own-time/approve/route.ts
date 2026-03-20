import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

async function getAuthenticatedClient(request: NextRequest) {
  const supabase = createServerClient(
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * POST /api/teacher/own-time/approve
 * Approve a student for Own Time.
 *
 * Body: { studentId, classId, unitId, note? }
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studentId, classId, unitId, note } = await request.json();

  if (!studentId || !classId) {
    return NextResponse.json({ error: "studentId and classId are required" }, { status: 400 });
  }

  // Verify the teacher owns this class
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!cls) {
    return NextResponse.json({ error: "Class not found or not yours" }, { status: 403 });
  }

  // Verify the student belongs to this class
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("class_id", classId)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found in this class" }, { status: 404 });
  }

  // Upsert approval (idempotent — re-approving after revoke re-enables)
  const { data: approval, error } = await supabase
    .from("own_time_approvals")
    .upsert(
      {
        student_id: studentId,
        class_id: classId,
        unit_id: unitId || null,
        teacher_note: note || null,
        approved_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: "student_id,class_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Own Time approval error:", error);
    return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
  }

  return NextResponse.json({ approval });
}

/**
 * GET /api/teacher/own-time/approve?classId=...
 * Get all Own Time approvals for a class.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classId = request.nextUrl.searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId required" }, { status: 400 });
  }

  // Verify ownership
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 403 });
  }

  const { data: approvals } = await supabase
    .from("own_time_approvals")
    .select("*")
    .eq("class_id", classId)
    .is("revoked_at", null);

  return NextResponse.json({
    approvals: approvals || [],
    // Map for quick lookup: studentId -> approval
    approvalMap: (approvals || []).reduce((acc: Record<string, unknown>, a: Record<string, unknown>) => {
      acc[a.student_id as string] = a;
      return acc;
    }, {} as Record<string, unknown>),
  });
}
