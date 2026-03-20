import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { v4 as uuid } from "uuid";

/**
 * Teacher NM Observation API
 *
 * POST /api/teacher/nm-observation
 *   → Submit teacher observation for one or more students.
 *   Body: {
 *     studentId: string;
 *     unitId: string;
 *     pageId?: string;
 *     assessments: [{ element: string; rating: 1-4; comment?: string }]
 *   }
 *
 * GET /api/teacher/nm-observation?unitId={id}&classId={id}
 *   → Fetch all NM assessment data for a unit in a class.
 */

function createSupabaseServer(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer(request);
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

  const { data: classData } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!classData) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, display_name")
    .eq("class_id", classId);

  if (!students || students.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: assessments } = await supabase
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
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { studentId, unitId, pageId, assessments } = body as {
    studentId: string;
    unitId: string;
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

  const { data: unit } = await supabase
    .from("units")
    .select("id, nm_config")
    .eq("id", unitId)
    .eq("teacher_id", user.id)
    .single();

  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  if (!unit.nm_config) {
    return NextResponse.json({ error: "NM not configured for unit" }, { status: 400 });
  }

  const competency = unit.nm_config.competencies?.[0];
  if (!competency) {
    return NextResponse.json({ error: "No competency configured for unit" }, { status: 400 });
  }

  const rows = assessments.map((a) => ({
    id: uuid(),
    student_id: studentId,
    unit_id: unitId,
    page_id: pageId || null,
    competency,
    element: a.element,
    source: "teacher_observation" as const,
    rating: a.rating,
    comment: a.comment || null,
    context: {},
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("competency_assessments").insert(rows);

  if (error) {
    console.error("[nm-observation] Insert error:", error);
    return NextResponse.json({ error: "Failed to save observation" }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: rows.length });
}
