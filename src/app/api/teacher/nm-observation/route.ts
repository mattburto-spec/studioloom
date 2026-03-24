import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuid } from "uuid";
import { verifyTeacherHasUnit, getNmConfigForClassUnit, verifyTeacherOwnsClass } from "@/lib/auth/verify-teacher-unit";

/**
 * Teacher NM Observation API
 *
 * POST /api/teacher/nm-observation
 *   → Submit teacher observation for a student.
 *   Body: {
 *     studentId: string;
 *     unitId: string;
 *     classId?: string;    // NEW: class context for per-class NM config + class_id on assessment
 *     pageId?: string;
 *     assessments: [{ element: string; rating: 1-4; comment?: string }]
 *   }
 *
 * GET /api/teacher/nm-observation?unitId={id}&classId={id}
 *   → Fetch all NM assessment data for a unit in a class.
 */

function getAuthClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");
  const classId = searchParams.get("classId");

  if (!unitId || !classId) {
    return NextResponse.json({ error: "unitId and classId are required" }, { status: 400 });
  }

  // Verify teacher owns this class (FIX: was using author_teacher_id on classes table)
  const ownsClass = await verifyTeacherOwnsClass(user.id, classId);
  if (!ownsClass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Get students via class_students junction (migration 041), fallback to legacy FK
  const { data: junctionRows } = await db
    .from("class_students")
    .select("student_id")
    .eq("class_id", classId);
  const junctionIds = (junctionRows || []).map((r: { student_id: string }) => r.student_id);

  let students: { id: string; display_name: string }[] = [];
  if (junctionIds.length > 0) {
    const { data } = await db.from("students").select("id, display_name").in("id", junctionIds);
    students = data || [];
  }
  if (students.length === 0) {
    const { data } = await db.from("students").select("id, display_name").eq("class_id", classId);
    students = data || [];
  }

  if (!students || students.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: assessments } = await db
    .from("competency_assessments")
    .select("*")
    .eq("unit_id", unitId)
    .in("student_id", students.map((s) => s.id));

  const result = students.map((student) => {
    const studentAssessments = (assessments || []).filter(
      (a) => a.student_id === student.id
    );

    const sourceCount = {
      student_self: studentAssessments.filter((a) => a.source === "student_self").length,
      teacher_observation: studentAssessments.filter((a) => a.source === "teacher_observation").length,
    };

    const latestPerElement: Record<string, { source: string; rating: number; comment: string | null }> = {};
    for (const a of studentAssessments) {
      const key = a.element;
      if (!latestPerElement[key] || new Date(a.created_at) > new Date((latestPerElement[key] as unknown as { created_at: string }).created_at)) {
        latestPerElement[key] = {
          source: a.source,
          rating: a.rating,
          comment: a.comment,
        };
      }
    }

    return { student, assessments: studentAssessments, sourceCount, latestPerElement };
  });

  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { studentId, unitId, classId, pageId, assessments } = body as {
    studentId: string;
    unitId: string;
    classId?: string;
    pageId?: string;
    assessments: Array<{ element: string; rating: number; comment?: string }>;
  };

  if (!studentId || !unitId || !Array.isArray(assessments) || assessments.length === 0) {
    return NextResponse.json({ error: "studentId, unitId, and assessments are required" }, { status: 400 });
  }

  for (const a of assessments) {
    if (typeof a.rating !== "number" || a.rating < 1 || a.rating > 4) {
      return NextResponse.json({ error: "Teacher rating must be 1-4" }, { status: 400 });
    }
  }

  // Verify teacher has access to this unit (authored OR assigned)
  const { hasAccess } = await verifyTeacherHasUnit(user.id, unitId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  // Get NM config (class-specific with fallback)
  let nmConfig: Record<string, unknown> | null = null;
  if (classId) {
    nmConfig = await getNmConfigForClassUnit(classId, unitId);
  } else {
    const db = createAdminClient();
    const { data: unit } = await db
      .from("units")
      .select("nm_config")
      .eq("id", unitId)
      .single();
    nmConfig = (unit?.nm_config as Record<string, unknown>) || null;
  }

  if (!nmConfig) {
    console.error("[nm-observation] No NM config found for", { classId, unitId });
    return NextResponse.json({ error: "NM not configured for this class/unit" }, { status: 400 });
  }

  const competency = (nmConfig as { competencies?: string[] }).competencies?.[0];
  if (!competency) {
    console.error("[nm-observation] NM config has no competencies:", JSON.stringify(nmConfig));
    return NextResponse.json({ error: "No competency configured — check NM setup" }, { status: 400 });
  }

  // Resolve class_id for the assessment record
  let resolvedClassId = classId || null;
  if (!resolvedClassId) {
    // Try to get class_id from the student record
    const db = createAdminClient();
    const { data: student } = await db
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .single();
    resolvedClassId = student?.class_id || null;
  }

  const db = createAdminClient();
  const rows = assessments.map((a) => ({
    id: uuid(),
    student_id: studentId,
    unit_id: unitId,
    class_id: resolvedClassId,
    page_id: pageId || null,
    competency,
    element: a.element,
    source: "teacher_observation" as const,
    rating: a.rating,
    comment: a.comment || null,
    context: {},
    created_at: new Date().toISOString(),
  }));

  const { error } = await db.from("competency_assessments").insert(rows);

  if (error) {
    console.error("[nm-observation] Insert error:", error);
    return NextResponse.json({ error: "Failed to save observation" }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: rows.length });
}
