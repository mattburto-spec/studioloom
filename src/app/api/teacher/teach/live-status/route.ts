import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/teacher/teach/live-status?classId=X&unitId=Y&pageId=Z
 *
 * Returns real-time student progress for a specific lesson/page.
 * Designed to be polled every 5-10 seconds during live teaching.
 *
 * Returns:
 * - students: array of { id, name, avatar, status, timeSpent, lastActive, responseCount }
 * - summary: { total, notStarted, inProgress, complete, avgTimeSpent }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const unitId = searchParams.get("unitId");
  const pageId = searchParams.get("pageId"); // optional — if null, returns unit-level progress

  if (!classId || !unitId) {
    return NextResponse.json({ error: "classId and unitId required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Verify teacher auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify teacher owns this class
  const { data: classData } = await supabase
    .from("classes")
    .select("id, teacher_id, name")
    .eq("id", classId)
    .single();

  if (!classData || classData.teacher_id !== user.id) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Get students in class
  const { data: students } = await supabase
    .from("students")
    .select("id, username, display_name, avatar_url, ell_level")
    .eq("class_id", classId)
    .order("display_name");

  if (!students || students.length === 0) {
    return NextResponse.json({
      students: [],
      summary: { total: 0, notStarted: 0, inProgress: 0, complete: 0, avgTimeSpent: 0 },
      className: classData.name,
    });
  }

  const studentIds = students.map((s) => s.id);

  // Get progress — either for one page or all pages in unit
  let progressQuery = supabase
    .from("student_progress")
    .select("student_id, page_id, status, time_spent, responses, updated_at")
    .eq("unit_id", unitId)
    .in("student_id", studentIds);

  if (pageId) {
    progressQuery = progressQuery.eq("page_id", pageId);
  }

  const { data: progressRows } = await progressQuery;

  // Get active sessions (students currently logged in — check student_sessions)
  const { data: activeSessions } = await supabase
    .from("student_sessions")
    .select("student_id, created_at")
    .in("student_id", studentIds)
    .gte("expires_at", new Date().toISOString());

  const activeSessionSet = new Set(
    (activeSessions || []).map((s) => s.student_id)
  );

  // Build per-student status
  const progressMap = new Map<string, typeof progressRows>();
  for (const row of progressRows || []) {
    if (!progressMap.has(row.student_id)) {
      progressMap.set(row.student_id, []);
    }
    progressMap.get(row.student_id)!.push(row);
  }

  type StudentStatus = {
    id: string;
    name: string;
    avatar: string | null;
    ellLevel: string;
    isOnline: boolean;
    status: "not_started" | "in_progress" | "complete";
    timeSpent: number; // seconds
    lastActive: string | null;
    responseCount: number;
    /** For page-level: how many response fields filled */
    completionPct: number;
    /** Flag: student may need help (no activity for >3 min while in_progress) */
    needsHelp: boolean;
  };

  const now = Date.now();
  const studentStatuses: StudentStatus[] = students.map((s) => {
    const rows = progressMap.get(s.id) || [];
    const isOnline = activeSessionSet.has(s.id);

    if (pageId) {
      // Single page mode
      const row = rows.find((r) => r.page_id === pageId);
      const responses = row?.responses as Record<string, unknown> | null;
      const responseCount = responses ? Object.keys(responses).filter((k) => {
        const v = responses[k];
        return v !== null && v !== undefined && v !== "";
      }).length : 0;

      const lastActive = row?.updated_at || null;
      const timeSinceUpdate = lastActive ? (now - new Date(lastActive).getTime()) / 1000 : Infinity;
      const needsHelp = isOnline && row?.status === "in_progress" && timeSinceUpdate > 180;

      return {
        id: s.id,
        name: s.display_name || s.username,
        avatar: s.avatar_url,
        ellLevel: s.ell_level || "none",
        isOnline,
        status: (row?.status as StudentStatus["status"]) || "not_started",
        timeSpent: row?.time_spent || 0,
        lastActive,
        responseCount,
        completionPct: 0, // Would need page section count to calculate
        needsHelp,
      };
    } else {
      // Unit-level mode — aggregate across all pages
      const totalTime = rows.reduce((sum, r) => sum + (r.time_spent || 0), 0);
      const completeCount = rows.filter((r) => r.status === "complete").length;
      const inProgressCount = rows.filter((r) => r.status === "in_progress").length;
      const responseCount = rows.reduce((sum, r) => {
        const resp = r.responses as Record<string, unknown> | null;
        return sum + (resp ? Object.keys(resp).filter((k) => resp[k] !== null && resp[k] !== "").length : 0);
      }, 0);

      const latestUpdate = rows.reduce((latest, r) => {
        return r.updated_at > latest ? r.updated_at : latest;
      }, "");

      const overallStatus: StudentStatus["status"] =
        completeCount > 0 && inProgressCount === 0 ? "complete" :
        completeCount > 0 || inProgressCount > 0 ? "in_progress" :
        "not_started";

      return {
        id: s.id,
        name: s.display_name || s.username,
        avatar: s.avatar_url,
        ellLevel: s.ell_level || "none",
        isOnline,
        status: overallStatus,
        timeSpent: totalTime,
        lastActive: latestUpdate || null,
        responseCount,
        completionPct: 0,
        needsHelp: false,
      };
    }
  });

  // Summary
  const total = studentStatuses.length;
  const notStarted = studentStatuses.filter((s) => s.status === "not_started").length;
  const inProgress = studentStatuses.filter((s) => s.status === "in_progress").length;
  const complete = studentStatuses.filter((s) => s.status === "complete").length;
  const avgTimeSpent = total > 0
    ? Math.round(studentStatuses.reduce((sum, s) => sum + s.timeSpent, 0) / total)
    : 0;
  const needsHelpCount = studentStatuses.filter((s) => s.needsHelp).length;
  const onlineCount = studentStatuses.filter((s) => s.isOnline).length;

  return NextResponse.json({
    students: studentStatuses,
    summary: {
      total,
      notStarted,
      inProgress,
      complete,
      avgTimeSpent,
      needsHelpCount,
      onlineCount,
    },
    className: classData.name,
  });
}
