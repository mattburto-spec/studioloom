/**
 * Teacher Badge Results API
 *
 * GET /api/teacher/badges/[id]/results
 *   Returns all student_badges + safety_results for a given badge,
 *   with student names joined from the students table.
 *   Optional: ?classId=xxx to filter by class.
 *
 *   Returns: {
 *     results: Array<{
 *       student_id: string;
 *       student_name: string;
 *       score: number;
 *       attempt_number: number;
 *       time_taken_seconds: number | null;
 *       status: 'active' | 'expired' | 'revoked';
 *       awarded_at: string;
 *       granted_by: string | null;
 *       teacher_note: string | null;
 *     }>;
 *     total_attempts: number;
 *     total_passed: number;
 *     average_score: number;
 *     badge_id: string;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const { teacherId } = auth;

    const { id } = await params;

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");

    const admin = createAdminClient();

    // Verify badge exists
    const { data: badgeData, error: badgeError } = await admin
      .from("badges")
      .select("id, pass_threshold")
      .eq("id", id)
      .single();

    if (badgeError || !badgeData) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    // If classId provided, get student IDs for that class
    let studentIdFilter: string[] | null = null;
    if (classId) {
      // Verify teacher owns this class
      const { data: cls } = await admin
        .from("classes")
        .select("id")
        .eq("id", classId)
        .eq("teacher_id", teacherId)
        .single();

      if (!cls) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }

      // Get students via junction table first, legacy fallback
      let classStudentRows: { id: string }[] | null = null;
      try {
        const { data: junctionRows } = await admin
          .from("class_students")
          .select("student_id")
          .eq("class_id", classId);
        if (junctionRows && junctionRows.length > 0) {
          const ids = junctionRows.map((r: { student_id: string }) => r.student_id);
          const { data } = await admin.from("students").select("id").in("id", ids);
          classStudentRows = data;
        }
      } catch {
        // Junction table may not exist
      }
      if (!classStudentRows || classStudentRows.length === 0) {
        const { data } = await admin.from("students").select("id").eq("class_id", classId);
        classStudentRows = data;
      }

      studentIdFilter = (classStudentRows || []).map((s: { id: string }) => s.id);

      if (studentIdFilter.length === 0) {
        return NextResponse.json({
          results: [],
          total_attempts: 0,
          total_passed: 0,
          average_score: 0,
          badge_id: id,
        });
      }
    }

    // Fetch student_badges for this badge
    let query = admin
      .from("student_badges")
      .select(
        `
        id,
        student_id,
        badge_id,
        score,
        attempt_number,
        granted_by,
        teacher_note,
        status,
        time_taken_seconds,
        awarded_at,
        expires_at,
        created_at
      `
      )
      .eq("badge_id", id);

    if (studentIdFilter) {
      query = query.in("student_id", studentIdFilter);
    }

    const { data: badgeResults, error: resultsError } = await query.order(
      "awarded_at",
      { ascending: false }
    );

    if (resultsError) {
      console.error("[badges/[id]/results] Query error:", resultsError);
      return NextResponse.json(
        { error: "Failed to fetch results" },
        { status: 500 }
      );
    }

    const records = badgeResults || [];

    // Get unique student IDs to fetch names
    const studentIds = [...new Set(records.map((r: any) => r.student_id))];

    // Fetch student names
    let studentNameMap: Record<string, string> = {};
    if (studentIds.length > 0) {
      const { data: students } = await admin
        .from("students")
        .select("id, display_name")
        .in("id", studentIds);

      for (const s of students || []) {
        studentNameMap[s.id] = s.display_name || "Unknown Student";
      }
    }

    // Also fetch safety_results (test attempts that may have failed — not in student_badges)
    let failQuery = admin
      .from("safety_results")
      .select(
        "id, student_id, badge_id, score, passed, attempt_number, time_taken_seconds, created_at"
      )
      .eq("badge_id", id)
      .eq("passed", false);

    if (studentIdFilter) {
      failQuery = failQuery.in("student_id", studentIdFilter);
    }

    const { data: failedAttempts } = await failQuery.order("created_at", {
      ascending: false,
    });

    // Fetch names for failed attempts too
    const failStudentIds = [
      ...new Set(
        (failedAttempts || [])
          .map((f: any) => f.student_id)
          .filter((sid: string) => !studentNameMap[sid])
      ),
    ];
    if (failStudentIds.length > 0) {
      const { data: moreStudents } = await admin
        .from("students")
        .select("id, display_name")
        .in("id", failStudentIds);
      for (const s of moreStudents || []) {
        studentNameMap[s.id] = s.display_name || "Unknown Student";
      }
    }

    // Build unified results list: earned badges + failed attempts
    const results: Array<{
      student_id: string;
      student_name: string;
      score: number;
      attempt_number: number;
      time_taken_seconds: number | null;
      status: string;
      awarded_at: string;
      granted_by: string | null;
      teacher_note: string | null;
    }> = [];

    // Add earned/active badges
    for (const r of records) {
      results.push({
        student_id: r.student_id,
        student_name: studentNameMap[r.student_id] || "Unknown Student",
        score: r.score ?? 0,
        attempt_number: r.attempt_number ?? 1,
        time_taken_seconds: r.time_taken_seconds,
        status: r.status || "active",
        awarded_at: r.awarded_at || r.created_at,
        granted_by: r.granted_by,
        teacher_note: r.teacher_note,
      });
    }

    // Add failed attempts
    for (const f of failedAttempts || []) {
      results.push({
        student_id: f.student_id,
        student_name: studentNameMap[f.student_id] || "Unknown Student",
        score: f.score ?? 0,
        attempt_number: f.attempt_number ?? 1,
        time_taken_seconds: f.time_taken_seconds,
        status: "failed",
        awarded_at: f.created_at,
        granted_by: null,
        teacher_note: null,
      });
    }

    // Sort by date descending
    results.sort(
      (a, b) =>
        new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime()
    );

    // Compute summary stats
    const totalAttempts = results.length;
    const totalPassed = records.filter(
      (r: any) => r.status === "active" && (r.score ?? 0) >= badgeData.pass_threshold
    ).length;
    const avgScore =
      totalAttempts > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / totalAttempts
        : 0;

    return NextResponse.json({
      results,
      total_attempts: totalAttempts,
      total_passed: totalPassed,
      average_score: avgScore,
      badge_id: id,
    });
  } catch (error) {
    console.error("[badges/[id]/results] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
