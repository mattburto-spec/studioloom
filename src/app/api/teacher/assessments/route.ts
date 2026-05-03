// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssessmentRecord } from "@/types/assessment";

async function getTeacherId(request: NextRequest): Promise<string | null> {
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
  return user?.id || null;
}

/**
 * GET: Fetch all assessments for a class + unit
 * Query: ?classId=X&unitId=Y
 */
export async function GET(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const unitId = searchParams.get("unitId");

  if (!classId || !unitId) {
    return NextResponse.json(
      { error: "classId and unitId are required" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  // Verify teacher owns this class
  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .single();

  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const { data: assessments, error } = await supabaseAdmin
    .from("assessment_records")
    .select("*")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .order("assessed_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch assessments" },
      { status: 500 }
    );
  }

  return NextResponse.json({ assessments: assessments || [] });
}

/**
 * PUT: Create or update an assessment record (upsert)
 * Body: { student_id, unit_id, class_id, data: AssessmentRecord, is_draft }
 */
export async function PUT(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    student_id,
    unit_id,
    class_id,
    data,
    is_draft,
  } = body as {
    student_id: string;
    unit_id: string;
    class_id: string;
    data: AssessmentRecord;
    is_draft: boolean;
  };

  if (!student_id || !unit_id || !class_id || !data) {
    return NextResponse.json(
      { error: "student_id, unit_id, class_id, and data are required" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  // Verify teacher owns this class
  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", class_id)
    .eq("teacher_id", teacherId)
    .single();

  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Set server-side fields
  const record: AssessmentRecord = {
    ...data,
    teacher_id: teacherId,
    assessed_at: new Date().toISOString(),
    is_draft: is_draft ?? true,
  };

  // Extract denormalized fields
  const overallGrade =
    typeof record.overall_grade === "number" ? record.overall_grade : null;

  const { data: row, error } = await supabaseAdmin
    .from("assessment_records")
    .upsert(
      {
        student_id,
        unit_id,
        class_id,
        teacher_id: teacherId,
        data: record,
        overall_grade: overallGrade,
        is_draft: is_draft ?? true,
        assessed_at: new Date().toISOString(),
      },
      { onConflict: "student_id,unit_id,class_id" }
    )
    .select("*")
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: "Failed to save assessment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ assessment: row });
}
