import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth, verifyTeacherOwnsClass } from "@/lib/auth/verify-teacher-unit";
import { computePaceSignals } from "@/lib/teaching-mode/pace";
import { getPageList } from "@/lib/unit-adapter";
import type { UnitContentData } from "@/types";

/**
 * GET /api/teacher/teach/live-status?classId=X&unitId=Y[&pageId=Z]
 *
 * Returns real-time student progress for a unit. Each student row reports
 * their ACTUAL current location (the lesson their most-recent progress row
 * touches), not the lesson the teacher happens to be viewing. This lets
 * Teaching Mode show one whole-class view even when the cohort is spread
 * across lessons after a partial-completion class.
 *
 * `pageId` is accepted for backwards compatibility but no longer filters
 * the student list. Pace cohort stats are computed per-current-lesson —
 * each student is compared against peers on the same lesson, not the
 * whole class.
 */
export const GET = withErrorHandler("teacher/teach/live-status:GET", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const unitId = searchParams.get("unitId");
  // pageId is accepted for backwards compat but no longer filters the
  // student list. See header comment.
  const _pageId = searchParams.get("pageId");
  void _pageId;

  if (!classId || !unitId) {
    return NextResponse.json({ error: "classId and unitId required" }, { status: 400 });
  }

  // Verify teacher owns this class
  const ownsClass = await verifyTeacherOwnsClass(teacherId, classId);
  if (!ownsClass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Get class name + unit content_data (used to map page_id → lesson title + index)
  const [{ data: classData }, { data: unitRow }] = await Promise.all([
    db.from("classes").select("id, name").eq("id", classId).single(),
    db.from("units").select("content_data").eq("id", unitId).maybeSingle(),
  ]);

  // Class-local fork takes precedence over master content if present.
  const { data: classUnitRow } = await db
    .from("class_units")
    .select("content_data")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .eq("is_active", true)
    .maybeSingle();

  const masterContent = (unitRow?.content_data as UnitContentData | null) ?? null;
  const classContent = (classUnitRow?.content_data as UnitContentData | null) ?? null;
  const resolvedContent: UnitContentData | null = classContent ?? masterContent;
  const pages = resolvedContent ? getPageList(resolvedContent) : [];
  const pageMeta = new Map<string, { index: number; title: string }>();
  pages.forEach((p, idx) => pageMeta.set(p.id, { index: idx, title: p.title || `Lesson ${idx + 1}` }));

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

  // Always fetch all unit progress rows. Whole-class Teaching Mode view
  // means we need per-student real location across every lesson, not the
  // selected one. pageId is accepted upstream but intentionally ignored
  // here — the lesson dropdown drives mini-lesson / projector / phase
  // context, but the student list shows actual location.
  const { data: progressRows } = await db
    .from("student_progress")
    .select("student_id, page_id, status, time_spent, responses, updated_at")
    .eq("unit_id", unitId)
    .in("student_id", studentIds);

  // Online = active anywhere in this unit in the last 5 min. Whole-unit
  // scope (not per-page) — Teaching Mode now shows everyone regardless of
  // which lesson they're on, so a student working on L1 should still
  // count as online when the teacher is viewing L2.
  const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentActivity } = await db
    .from("student_progress")
    .select("student_id")
    .in("student_id", studentIds)
    .eq("unit_id", unitId)
    .gte("updated_at", FIVE_MIN_AGO);

  const activeSessionSet = new Set(
    (recentActivity || []).map((s) => s.student_id)
  );

  // Doing-card lookup — surfaces each student's current committed work
  // (from First Move kanban WIP=1 enforcement) to Teaching Mode so the
  // teacher can ask "how's the wheel coming?" instead of "are you
  // working?" — useful for self-directed studio classes where most of
  // the actual work happens in external tools (Onshape, hand tools, etc).
  // Filters via doing_count > 0 so we only fetch boards that have one.
  const { data: kanbanRows } = await db
    .from("student_unit_kanban")
    .select("student_id, cards")
    .in("student_id", studentIds)
    .eq("unit_id", unitId)
    .gt("doing_count", 0);

  const doingMap = new Map<string, string>();
  for (const row of kanbanRows || []) {
    const cards = (row.cards as Array<{ status: string; title: string }>) || [];
    const doing = cards.find((c) => c?.status === "doing" && c?.title);
    if (doing) {
      doingMap.set(row.student_id, doing.title);
    }
  }

  // Build per-student status. Each student's "current location" is the
  // page their most-recent updated_at row touches. Status/responseCount/
  // lastActive reflect THAT page, not whichever lesson the teacher is
  // viewing — so a row tells the teacher where the student actually is.
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
    timeSpent: number; // seconds — aggregate across the unit
    lastActive: string | null;
    responseCount: number; // responses on the student's CURRENT lesson
    completionPct: number;
    needsHelp: boolean;
    paceZ: number | null;
    doingCardTitle: string | null;
    /** Page id of the student's most-recent progress row (their actual
     *  current lesson). Null if they've never touched the unit. */
    currentLessonId: string | null;
    /** 0-based index in the unit's page list. Null if the page can't be
     *  resolved (e.g. content_data drift) or no rows yet. */
    currentLessonIndex: number | null;
    /** Lesson title at currentLessonIndex. */
    currentLessonTitle: string | null;
  };

  const now = Date.now();
  const studentStatuses: StudentStatus[] = students.map((s) => {
    const rows = progressMap.get(s.id) || [];
    const isOnline = activeSessionSet.has(s.id);
    const totalTime = rows.reduce((sum, r) => sum + (r.time_spent || 0), 0);

    // Most-recent row = current location.
    const currentRow = rows.length > 0
      ? rows.reduce((latest, r) => (r.updated_at > latest.updated_at ? r : latest))
      : null;
    const currentLessonId = currentRow?.page_id ?? null;
    const meta = currentLessonId ? pageMeta.get(currentLessonId) : undefined;
    const currentLessonIndex = meta ? meta.index : null;
    const currentLessonTitle = meta ? meta.title : null;

    const responses = currentRow?.responses as Record<string, unknown> | null;
    const responseCount = responses ? Object.keys(responses).filter((k) => {
      const v = responses[k];
      return v !== null && v !== undefined && v !== "";
    }).length : 0;

    const lastActive = currentRow?.updated_at || null;
    const timeSinceUpdate = lastActive ? (now - new Date(lastActive).getTime()) / 1000 : Infinity;
    const needsHelp = isOnline && currentRow?.status === "in_progress" && timeSinceUpdate > 180;

    return {
      id: s.id,
      name: s.display_name || s.username,
      avatar: s.avatar_url,
      ellLevel: s.ell_level || "none",
      isOnline,
      status: (currentRow?.status as StudentStatus["status"]) || "not_started",
      timeSpent: totalTime,
      lastActive,
      responseCount,
      completionPct: 0,
      needsHelp,
      paceZ: null, // Filled in post-pass below.
      doingCardTitle: doingMap.get(s.id) ?? null,
      currentLessonId,
      currentLessonIndex,
      currentLessonTitle,
    };
  });

  // Pace signals — per-current-lesson cohort. Each student is compared
  // against peers on the SAME lesson, not the whole class. Cohorts <5 stay
  // unscored. This is strictly more accurate than the old global cohort
  // when the class is spread across lessons.
  const cohortsByLesson = new Map<string, StudentStatus[]>();
  for (const s of studentStatuses) {
    if (s.status !== "in_progress" || !s.currentLessonId) continue;
    if (!cohortsByLesson.has(s.currentLessonId)) cohortsByLesson.set(s.currentLessonId, []);
    cohortsByLesson.get(s.currentLessonId)!.push(s);
  }
  const paceMap = new Map<string, number | null>();
  for (const cohort of cohortsByLesson.values()) {
    const { results } = computePaceSignals(
      cohort.map((s) => ({ studentId: s.id, responseCount: s.responseCount })),
    );
    for (const r of results) paceMap.set(r.studentId, r.paceZ);
  }
  for (const s of studentStatuses) {
    const z = paceMap.get(s.id);
    s.paceZ = z === undefined ? null : z;
  }
  // cohortStats kept null in whole-class mode — there is no single
  // dominant cohort to summarise. UI no longer surfaces this anyway.
  const cohortStats = null;

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
