import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth, verifyTeacherOwnsClass } from "@/lib/auth/verify-teacher-unit";
import { computePaceSignals } from "@/lib/teaching-mode/pace";

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
export const GET = withErrorHandler("teacher/teach/live-status:GET", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const unitId = searchParams.get("unitId");
  const pageId = searchParams.get("pageId"); // optional — if null, returns unit-level progress

  if (!classId || !unitId) {
    return NextResponse.json({ error: "classId and unitId required" }, { status: 400 });
  }

  // Verify teacher owns this class
  const ownsClass = await verifyTeacherOwnsClass(teacherId, classId);
  if (!ownsClass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Get class name
  const { data: classData } = await db
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .single();

  // Get students in class — junction table + legacy class_id, merged & deduplicated
  const { data: junctionRows } = await db
    .from("class_students")
    .select("student_id")
    .eq("class_id", classId);
  const junctionStudentIds = (junctionRows || []).map((r: { student_id: string }) => r.student_id);

  const [junctionResult, legacyResult] = await Promise.all([
    junctionStudentIds.length > 0
      ? db.from("students").select("id, username, display_name, avatar_url, ell_level").in("id", junctionStudentIds)
      : Promise.resolve({ data: [] as any[] }),
    db.from("students").select("id, username, display_name, avatar_url, ell_level").eq("class_id", classId),
  ]);

  // Merge both sources, deduplicate by ID
  const studentMap = new Map<string, { id: string; username: string; display_name: string; avatar_url: string | null; ell_level: string | null }>();
  for (const s of junctionResult.data || []) studentMap.set(s.id, s);
  for (const s of legacyResult.data || []) { if (!studentMap.has(s.id)) studentMap.set(s.id, s); }
  const students = Array.from(studentMap.values()).sort((a, b) =>
    (a.display_name || a.username).localeCompare(b.display_name || b.username)
  );

  if (!students || students.length === 0) {
    return NextResponse.json({
      students: [],
      summary: { total: 0, notStarted: 0, inProgress: 0, complete: 0, avgTimeSpent: 0 },
      className: classData?.name || "",
    });
  }

  const studentIds = students.map((s) => s.id);

  // Get progress — either for one page or all pages in unit
  let progressQuery = db
    .from("student_progress")
    .select("student_id, page_id, status, time_spent, responses, updated_at")
    .eq("unit_id", unitId)
    .in("student_id", studentIds);

  if (pageId) {
    progressQuery = progressQuery.eq("page_id", pageId);
  }

  const { data: progressRows } = await progressQuery;

  // Phase 6.1 (4 May 2026) — derive "online" from student_progress activity
  // rather than student_sessions (table dropped in 6.1). A student counts as
  // online if they updated *any* progress row in the last 5 minutes. This is
  // a better Teach-Mode signal than session-token presence: it tracks actual
  // engagement, not "logged in 4 hours ago and walked away".
  const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentActivity } = await db
    .from("student_progress")
    .select("student_id")
    .in("student_id", studentIds)
    .gte("updated_at", FIVE_MIN_AGO);

  const activeSessionSet = new Set(
    (recentActivity || []).map((s) => s.student_id)
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
    /** Pace z-score vs in-progress cohort on this lesson; null if cohort <5 or not in_progress */
    paceZ: number | null;
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
        paceZ: null, // Filled in post-pass below
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
        paceZ: null, // Pace only meaningful in page mode
      };
    }
  });

  // Pace signals — only over students currently in_progress on this lesson.
  // Unit mode (no pageId) skips this; paceZ stays null. Phase 1.
  const paceInputs = pageId
    ? studentStatuses
        .filter((s) => s.status === "in_progress")
        .map((s) => ({ studentId: s.id, responseCount: s.responseCount }))
    : [];
  const { results: paceResults, stats: paceStatsRaw } = computePaceSignals(paceInputs);
  const paceMap = new Map(paceResults.map((r) => [r.studentId, r.paceZ]));
  for (const s of studentStatuses) {
    const z = paceMap.get(s.id);
    s.paceZ = z === undefined ? null : z;
  }
  const cohortStats = pageId && paceInputs.length > 0
    ? {
        inProgressCount: paceStatsRaw.n,
        medianResponses: paceStatsRaw.median,
        meanResponses: paceStatsRaw.mean,
        stddevResponses: paceStatsRaw.stddev,
      }
    : null;

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
      cohortStats,
    },
    className: classData?.name || "",
  });
});
