import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { UnitContentData } from "@/types";

// ---------------------------------------------------------------------------
// GET /api/teacher/student-snapshot
// Returns a comprehensive snapshot of one student's status for a unit+class.
// Used by the StudentDrawer component in the Class Hub.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireTeacherAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const teacherId = (auth as any).teacherId;
  const url = req.nextUrl;
  const studentId = url.searchParams.get("studentId");
  const unitId = url.searchParams.get("unitId");
  const classId = url.searchParams.get("classId");

  if (!studentId || !unitId || !classId) {
    return NextResponse.json({ error: "Missing studentId, unitId, or classId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify teacher owns this class
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!cls) {
    // Fallback: try author_teacher_id
    const { data: cls2 } = await supabase
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("author_teacher_id", teacherId)
      .maybeSingle();
    if (!cls2) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  // Parallel fetches
  const [
    unitRes,
    classUnitRes,
    progressRes,
    assessmentRes,
    nmRes,
    badgeRes,
    osRes,
    paceRes,
  ] = await Promise.all([
    // Unit content (for page list)
    supabase.from("units").select("title, content_data").eq("id", unitId).single(),
    // Class-unit fork content
    supabase.from("class_units").select("content_data").eq("class_id", classId).eq("unit_id", unitId).maybeSingle(),
    // Student progress (all pages)
    supabase.from("student_progress").select("page_id, status, responses, time_spent, updated_at").eq("student_id", studentId).eq("unit_id", unitId),
    // Grades/assessments
    supabase.from("assessments").select("criterion_scores, overall_grade, comments, strengths, growth_areas, is_draft, updated_at").eq("student_id", studentId).eq("unit_id", unitId).maybeSingle(),
    // NM assessments
    supabase.from("competency_assessments").select("competency, element, source, rating, comment, created_at").eq("student_id", studentId).eq("unit_id", unitId).order("created_at", { ascending: false }).limit(20),
    // Safety badge status
    supabase.from("student_badges").select("badge_id, status, score, attempt_number, awarded_at, badges(title)").eq("student_id", studentId),
    // Open Studio status
    supabase.from("open_studio_status").select("status, unlocked_at, revoked_at, sessions_count").eq("student_id", studentId).eq("unit_id", unitId).maybeSingle(),
    // Pace feedback
    supabase.from("lesson_feedback").select("page_id, feedback_data, created_at").eq("student_id", studentId).eq("unit_id", unitId).order("created_at", { ascending: false }).limit(10),
  ]);

  // Resolve pages
  const masterContent = unitRes.data?.content_data as UnitContentData | undefined;
  const forkContent = classUnitRes.data?.content_data as UnitContentData | undefined;
  const resolvedContent = masterContent ? resolveClassUnitContent(masterContent, forkContent) : undefined;
  const pages = getPageList(resolvedContent).map(p => ({
    id: p.id,
    title: p.title || p.content?.title || p.id,
  }));

  // Build progress map
  const progress: Record<string, { status: string; timeSpent: number; updatedAt: string; hasResponses: boolean }> = {};
  for (const p of progressRes.data || []) {
    progress[p.page_id] = {
      status: p.status,
      timeSpent: p.time_spent || 0,
      updatedAt: p.updated_at,
      hasResponses: p.responses !== null && typeof p.responses === "object" && Object.keys(p.responses as Record<string, unknown>).length > 0,
    };
  }

  // Recent responses (last 5 pages with actual content)
  const recentWork = (progressRes.data || [])
    .filter(p => p.responses && typeof p.responses === "object" && Object.keys(p.responses as Record<string, unknown>).length > 0)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)
    .map(p => {
      const responses = p.responses as Record<string, string>;
      const firstKey = Object.keys(responses)[0];
      const preview = firstKey ? String(responses[firstKey]).slice(0, 150) : "";
      const pageTitle = pages.find(pg => pg.id === p.page_id)?.title || p.page_id;
      return {
        pageId: p.page_id,
        pageTitle,
        updatedAt: p.updated_at,
        preview,
        responseCount: Object.keys(responses).length,
      };
    });

  // Grades
  const grades = assessmentRes.data ? {
    criterionScores: assessmentRes.data.criterion_scores as Record<string, number> | null,
    overallGrade: assessmentRes.data.overall_grade,
    comments: assessmentRes.data.comments,
    strengths: assessmentRes.data.strengths,
    growthAreas: assessmentRes.data.growth_areas,
    isDraft: assessmentRes.data.is_draft,
    updatedAt: assessmentRes.data.updated_at,
  } : null;

  // NM assessments — group by element, latest first
  const nmAssessments = (nmRes.data || []).map(a => ({
    element: a.element,
    source: a.source,
    rating: a.rating,
    comment: a.comment,
    createdAt: a.created_at,
  }));

  // Safety badges
  const badges = (badgeRes.data || []).map((b: any) => ({
    badgeId: b.badge_id,
    badgeTitle: b.badges?.title || "Unknown",
    status: b.status,
    score: b.score,
    attempt: b.attempt_number,
    awardedAt: b.awarded_at,
  }));

  // Open Studio
  const openStudio = osRes.data ? {
    status: osRes.data.status,
    unlockedAt: osRes.data.unlocked_at,
    revokedAt: osRes.data.revoked_at,
    sessionCount: osRes.data.sessions_count,
  } : null;

  // Pace feedback
  const paceFeedback = (paceRes.data || []).map(f => ({
    pageId: f.page_id,
    pace: (f.feedback_data as { pace?: string })?.pace || null,
    createdAt: f.created_at,
  }));

  // Summary stats
  const pagesCompleted = Object.values(progress).filter(p => p.status === "complete").length;
  const totalTimeSpent = Object.values(progress).reduce((sum, p) => sum + p.timeSpent, 0);

  return NextResponse.json({
    pages,
    progress,
    pagesCompleted,
    totalPages: pages.length,
    totalTimeSpent,
    grades,
    nmAssessments,
    badges,
    openStudio,
    paceFeedback,
    recentWork,
  });
}
