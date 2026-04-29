import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/student/grades?unitId={id}
 * Returns the student's published assessment for a unit.
 */
export async function GET(request: NextRequest) {
  // Phase 1.4b — explicit Supabase Auth via requireStudentSession.
  // Dual-mode fallback to legacy still works automatically (Phase 1.4a wrapper).
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const unitId = request.nextUrl.searchParams.get("unitId");
  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Get unit title
  const { data: unit } = await db
    .from("units")
    .select("title")
    .eq("id", unitId)
    .single();

  // Find student's class for this unit
  const { data: classUnit } = await db
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .limit(10);

  const classIds = (classUnit || []).map((r: { class_id: string }) => r.class_id);

  // Get published assessment (not draft)
  let assessment = null;

  if (classIds.length > 0) {
    const { data } = await db
      .from("assessment_records")
      .select("data, overall_grade, is_draft")
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .in("class_id", classIds)
      .eq("is_draft", false)
      .order("assessed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      assessment = {
        ...(data.data as Record<string, unknown>),
        overall_grade: data.overall_grade,
        is_draft: data.is_draft,
      };
    }
  }

  // Fallback: try without class filter (legacy data)
  if (!assessment) {
    const { data } = await db
      .from("assessment_records")
      .select("data, overall_grade, is_draft")
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .eq("is_draft", false)
      .order("assessed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      assessment = {
        ...(data.data as Record<string, unknown>),
        overall_grade: data.overall_grade,
        is_draft: data.is_draft,
      };
    }
  }

  return NextResponse.json(
    { assessment, unitTitle: unit?.title || "" },
    {
      headers: { "Cache-Control": "private, no-cache" },
    }
  );
}