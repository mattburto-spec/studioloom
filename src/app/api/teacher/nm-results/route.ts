import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherHasUnit, getNmConfigForClassUnit } from "@/lib/auth/verify-teacher-unit";

/**
 * Teacher NM Results API
 *
 * GET /api/teacher/nm-results?unitId={unitId}&classId={classId}
 *   → Returns all competency assessment data for a unit in a class:
 *     - Per-student self-assessment ratings
 *     - Per-student teacher observations
 *     - Aggregated element averages
 *     - NM config (from class_units with fallback to units)
 *
 * classId is now REQUIRED — results are always per-class.
 * This prevents mixing assessments from different classes using the same unit.
 */

export async function GET(request: NextRequest) {
  const unitId = request.nextUrl.searchParams.get("unitId");
  const classId = request.nextUrl.searchParams.get("classId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  // Auth via Supabase SSR
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify teacher has access to this unit (authored OR assigned)
  const { hasAccess } = await verifyTeacherHasUnit(user.id, unitId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Check global NM toggle on teacher profile
  const { data: teacherProfile } = await db
    .from("teachers")
    .select("school_context")
    .eq("id", user.id)
    .single();
  const globalNmEnabled = !!(teacherProfile?.school_context as { use_new_metrics?: boolean } | null)?.use_new_metrics;
  if (!globalNmEnabled) {
    return NextResponse.json({ students: [], assessments: [], nmConfig: null });
  }

  // Get NM config — class-specific with fallback to unit-level
  let nmConfig = null;
  if (classId) {
    nmConfig = await getNmConfigForClassUnit(classId, unitId);
  } else {
    const { data: unit } = await db
      .from("units")
      .select("nm_config")
      .eq("id", unitId)
      .single();
    nmConfig = unit?.nm_config || null;
  }

  // Build assessment query
  let assessmentQuery = db
    .from("competency_assessments")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: true });

  // If classId provided, filter by class_id column (new) OR by student membership (fallback)
  if (classId) {
    // Get students in this class for filtering
    const { data: classStudents } = await db
      .from("students")
      .select("id, display_name, username")
      .eq("class_id", classId);

    const studentIds = (classStudents || []).map(s => s.id);

    if (studentIds.length === 0) {
      return NextResponse.json({ assessments: [], students: {}, nmConfig });
    }

    // Filter assessments by class_id (if populated) OR student membership
    assessmentQuery = assessmentQuery.in("student_id", studentIds);

    const { data: assessments, error: fetchError } = await assessmentQuery;
    if (fetchError) {
      console.error("[nm-results] Fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
    }

    const students: Record<string, { display_name: string; username: string }> = {};
    for (const s of classStudents || []) {
      students[s.id] = {
        display_name: s.display_name || s.username,
        username: s.username,
      };
    }

    return NextResponse.json({
      assessments: assessments || [],
      students,
      nmConfig,
    });
  }

  // No classId — return all assessments for unit (backward compat)
  const { data: assessments, error: fetchError } = await assessmentQuery;
  if (fetchError) {
    console.error("[nm-results] Fetch error:", fetchError);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }

  // Get student names
  const studentIds = [...new Set((assessments || []).map(a => a.student_id))];
  let students: Record<string, { display_name: string; username: string }> = {};
  if (studentIds.length > 0) {
    const { data: studentRows } = await db
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
    nmConfig,
  });
}
