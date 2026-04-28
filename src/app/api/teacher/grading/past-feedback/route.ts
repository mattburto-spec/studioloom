/**
 * GET /api/teacher/grading/past-feedback?student_id=X&exclude_unit_id=Y
 *
 * Returns the teacher's most recent prior released assessment_records for
 * this student, EXCLUDING the unit currently being marked. Surfaced in the
 * Synthesize view as an amber "you said 3 weeks ago …" callout — the
 * unconventional feature called out in the G1 brief §0 design lock.
 *
 * Auth: teacher Supabase session. RLS on assessment_records already scopes
 * by class.teacher_id, so we get the right rows just by querying with the
 * authenticated client.
 *
 * Returns up to 3 records, newest first. Drafts (is_draft=true) are
 * excluded — only released records counted as "feedback the student saw".
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

async function buildClient(request: NextRequest) {
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
    },
  );
}

export async function GET(request: NextRequest) {
  const supabase = await buildClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("student_id");
  const excludeUnitId = searchParams.get("exclude_unit_id");
  if (!studentId) {
    return NextResponse.json({ error: "student_id is required" }, { status: 400 });
  }

  let query = supabase
    .from("assessment_records")
    .select("id, unit_id, class_id, data, overall_grade, assessed_at, units(title)")
    .eq("student_id", studentId)
    .eq("is_draft", false)
    .order("assessed_at", { ascending: false })
    .limit(3);

  if (excludeUnitId) {
    query = query.neq("unit_id", excludeUnitId);
  }

  const { data: records, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch past feedback: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ records: records ?? [] });
}
