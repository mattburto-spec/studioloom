import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
 * Creates one competency_assessments row per element.
 * Source = 'teacher_observation', rating must be 1-4.
 *
 * GET /api/teacher/nm-observation?unitId={id}&classId={id}
 *   → Fetch all NM assessment data for a unit in a class.
 *   Returns all competency_assessments rows grouped by student.
 */

function getSupabase(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const accessToken = request.cookies.get("sb-access-token")?.value;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);

  // Verify teacher auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const { data: classData } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!classData) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Get all students in the class
  const { data: students } = await supabase
    .from("students")
    .select("id, display_name")
    .eq("class_id", classId);

  if (!students || students.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Get all competency assessments for this unit
  const { data: assessments } = await supabase
    .from("competency_assessments")
    .select("*")
    .eq("unit_id", unitId)
    .in(
      "student_id",
      students.map((s) => s.id)
    );

  // Group by student and compute stats
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const result = students.map((student) => {
    const studentAssessments = (assessments || []).filter(
      (a) => a.student_id === student.id
    );

    // Count by source
    const sourceCount = {
      student_self: studentAssessments.filter((a) => a.source === "student_self").length,
      teacher_observation: studentAssessments.filter((a) => a.source === "teacher_observation").length,
    };

    // Get latest rating per element
    const latestPerElement: Record<string, { source: string; rating: number; comment: string | null }> = {};
    for (const a of studentAssessments) {
      const key = a.element;
      const existing = latestPerElement[key];
      if (!existing || new Date(a.created_at) > new Date(existing.created_at)) {
        latestPerElement[key] = {
          source: a.source,
          rating: a.rating,
          comment: a.comment,
        };
      }
    }

    return {
      student,
      assessments: studentAssessments,
      sourceCount,
      latestPerElement,
    };
  });

  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);

  // Verify teacher auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    studentId,
    unitId,
    pageId,
    assessments,
  } = body as {
    studentId: string;
    unitId: string;
    pageId?: string;
    assessments: Array<{ element: string; rating: number; comment?: string }>;
  };

  if (!studentId || !unitId || !Array.isArray(assessments) || assessments.length === 0) {
    return NextResponse.json(
      { error: "studentId, unitId, and assessments are required" },
      { status: 400 }
    );
  }

  // Validate all ratings are 1-4 for teacher observation
  for (const a of assessments) {
    if (typeof a.rating !== "number" || a.rating < 1 || a.rating > 4) {
      return NextResponse.json(
        { error: "Teacher rating must be 1-4" },
        { status: 400 }
      );
    }
  }

  // Verify teacher owns the unit
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
    return NextResponse.json(
      { error: "NM not configured for unit" },
      { status: 400 }
    );
  }

  const competency = unit.nm_config.competencies?.[0]; // Use primary competency

  if (!competency) {
    return NextResponse.json(
      { error: "No competency configured for unit" },
      { status: 400 }
    );
  }

  // Insert rows into competency_assessments
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
    return NextResponse.json(
      { error: "Failed to save observation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, count: rows.length });
}
