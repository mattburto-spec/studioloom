import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherHasUnit, getNmConfigForClassUnit } from "@/lib/auth/verify-teacher-unit";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { normalizeContentData, getPageList } from "@/lib/unit-adapter";
import { requireTeacher } from "@/lib/auth/require-teacher";

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

  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  // Verify teacher has access to this unit (authored OR assigned)
  const { hasAccess } = await verifyTeacherHasUnit(teacherId, unitId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Note: The per-class NM config with enabled=true is sufficient intent.
  // The global use_new_metrics toggle in teacher settings is NOT required here —
  // if a teacher configured NM checkpoints on a class-unit, that's explicit enough.

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

  // Build page name mapping from unit content
  const pageNames: Record<string, string> = {};
  try {
    const { data: unitRow } = await db.from("units").select("content_data").eq("id", unitId).single();
    let contentData = unitRow?.content_data;
    if (classId) {
      const { data: cuRow } = await db.from("class_units").select("content_data").eq("class_id", classId).eq("unit_id", unitId).maybeSingle();
      contentData = resolveClassUnitContent(contentData, cuRow?.content_data);
    }
    if (contentData) {
      const pages = getPageList(contentData);
      for (const page of pages) {
        if (page.id && page.title) {
          pageNames[page.id] = page.title;
        }
      }
    }
  } catch {
    // Non-critical — results still work without page names
  }

  // Build assessment query
  let assessmentQuery = db
    .from("competency_assessments")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: true });

  // If classId provided, filter by class_id column (new) OR by student membership (fallback)
  if (classId) {
    // Get students in this class via junction table (migration 041)
    const { data: junctionRows } = await db
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId);
    const junctionIds = (junctionRows || []).map((r: { student_id: string }) => r.student_id);

    // Fallback to legacy class_id FK if junction empty
    let classStudents: { id: string; display_name: string; username: string }[] = [];
    if (junctionIds.length > 0) {
      const { data } = await db
        .from("students")
        .select("id, display_name, username")
        .in("id", junctionIds);
      classStudents = data || [];
    }
    if (classStudents.length === 0) {
      const { data } = await db
        .from("students")
        .select("id, display_name, username")
        .eq("class_id", classId);
      classStudents = data || [];
    }

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
      pageNames,
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
