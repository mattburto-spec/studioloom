import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Teacher NM Results API
 *
 * GET /api/teacher/nm-results?unitId={unitId}
 *   → Returns all competency assessment data for a unit:
 *     - Per-student self-assessment ratings
 *     - Per-student teacher observations
 *     - Aggregated element averages
 */

export async function GET(request: NextRequest) {
  const unitId = request.nextUrl.searchParams.get("unitId");
  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  // Supabase SSR auth
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify teacher owns this unit
  const { data: unit } = await supabase
    .from("units")
    .select("id, nm_config, title")
    .eq("id", unitId)
    .eq("author_teacher_id", user.id)
    .single();

  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  // Get all assessments for this unit
  const { data: assessments, error: fetchError } = await supabase
    .from("competency_assessments")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: true });

  if (fetchError) {
    console.error("[nm-results] Fetch error:", fetchError);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }

  // Get student names for display
  const studentIds = [...new Set((assessments || []).map(a => a.student_id))];

  let students: Record<string, { display_name: string; username: string }> = {};
  if (studentIds.length > 0) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, display_name, username")
      .in("id", studentIds);

    if (studentRows) {
      students = Object.fromEntries(
        studentRows.map(s => [s.id, { display_name: s.display_name || s.username, username: s.username }])
      );
    }
  }

  return NextResponse.json({
    assessments: assessments || [],
    students,
    nmConfig: unit.nm_config,
  });
}
