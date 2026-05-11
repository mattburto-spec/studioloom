// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { v4 as uuid } from "uuid";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";

/**
 * Student NM Assessment Submission API
 *
 * POST /api/student/nm-assessment
 *   → Submit student self-assessment for a checkpoint.
 *   Body: {
 *     unitId: string;
 *     pageId: string;
 *     assessments: [{ element: string; rating: 1-3; comment?: string }]
 *   }
 *
 * Creates one competency_assessments row per element.
 * Source = 'student_self', rating must be 1-3.
 * Rate limited: 10/min per student.
 */

// In-memory rate limit map: studentId → { count, resetAt }
const studentRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(studentId: string): boolean {
  const now = Date.now();
  const existing = studentRateLimitMap.get(studentId);

  if (!existing || now >= existing.resetAt) {
    // Reset window
    studentRateLimitMap.set(studentId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (existing.count >= 10) {
    return false; // Rate limited
  }

  existing.count++;
  return true;
}

/**
 * Round 32 (7 May 2026, NIS Class 1) — GET handler so CompetencyPulse
 * can detect whether the student has already submitted a self-
 * assessment for this checkpoint on mount. Per Matt: "after a student
 * completes the NM survey it shows a big pop art 'New Metrics Feedback
 * Done!' as i dont need them to ever go back to a lesson and do it
 * again." On refresh, the component fetches this and skips straight
 * to the celebration if a prior submission exists.
 *
 * GET /api/student/nm-assessment?unitId=&pageId=
 *   → { submitted: boolean }
 *   200 with submitted=true if at least one competency_assessment row
 *   exists for (student, unit, page) with source='student_self'.
 *   200 with submitted=false otherwise. Auth-required.
 */
export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const url = new URL(request.url);
  const unitId = url.searchParams.get("unitId");
  const pageId = url.searchParams.get("pageId");

  if (!unitId || !pageId) {
    return NextResponse.json(
      { error: "unitId and pageId required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("competency_assessments")
    .select("id")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .eq("page_id", pageId)
    .eq("source", "student_self")
    .limit(1);

  if (error) {
    console.error("[nm-assessment GET] supabase error:", error.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  return NextResponse.json({ submitted: (data?.length ?? 0) > 0 });
}

export async function POST(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  // Check rate limit
  if (!checkRateLimit(studentId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded (10 per minute)" },
      { status: 429 }
    );
  }

  const supabase = createAdminClient();

  const body = await request.json();
  const {
    unitId,
    pageId,
    assessments,
  } = body as {
    unitId: string;
    pageId: string;
    assessments: Array<{ element: string; rating: number; comment?: string }>;
  };

  if (!unitId || !pageId || !Array.isArray(assessments) || assessments.length === 0) {
    return NextResponse.json(
      { error: "unitId, pageId, and assessments are required" },
      { status: 400 }
    );
  }

  // Validate all ratings are 1-3 for student self-assessment
  for (const a of assessments) {
    if (typeof a.rating !== "number" || a.rating < 1 || a.rating > 3) {
      return NextResponse.json(
        { error: "Student rating must be 1-3" },
        { status: 400 }
      );
    }
  }

  // Get student's class IDs — junction table first, then legacy fallback
  const { data: junctionRows } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);

  const classIds: string[] = (junctionRows || []).map((r: { class_id: string }) => r.class_id);

  if (classIds.length === 0) {
    const { data: student } = await supabase
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .single();
    if (student?.class_id) classIds.push(student.class_id);
  }

  // Use the first class that has this unit assigned
  let classId: string | null = null;

  // Get NM config: class-specific (class_units) with fallback to unit-level (units)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nmConfig: any = null;

  if (classIds.length > 0) {
    // Filter is_active so soft-removed assignments don't surface stale
    // NM config. Same root cause as PRs #189/#196/#199 —
    // FU-CLASS-UNITS-IS-ACTIVE-AUDIT.
    const { data: classUnits } = await supabase
      .from("class_units")
      .select("class_id, nm_config")
      .in("class_id", classIds)
      .eq("unit_id", unitId)
      .eq("is_active", true);

    const cuWithNm = (classUnits || []).find((cu: { nm_config: unknown }) => cu.nm_config);
    if (cuWithNm) {
      classId = cuWithNm.class_id;
      nmConfig = cuWithNm.nm_config;
    } else if (classUnits && classUnits.length > 0) {
      classId = classUnits[0].class_id;
    }
  }

  if (!nmConfig) {
    // Fallback to unit-level config
    const { data: unit } = await supabase
      .from("units")
      .select("nm_config")
      .eq("id", unitId)
      .single();
    nmConfig = unit?.nm_config || null;
  }

  if (!nmConfig) {
    return NextResponse.json({ error: "Unit not found or NM not configured" }, { status: 404 });
  }

  const competency = nmConfig.competencies?.[0]; // Use primary competency

  if (!competency) {
    return NextResponse.json(
      { error: "No competency configured for unit" },
      { status: 400 }
    );
  }

  // Insert rows into competency_assessments (now includes class_id)
  const rows = assessments.map((a) => ({
    id: uuid(),
    student_id: studentId,
    unit_id: unitId,
    class_id: classId,
    page_id: pageId,
    competency,
    element: a.element,
    source: "student_self" as const,
    rating: a.rating,
    comment: a.comment || null,
    context: {},
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("competency_assessments").insert(rows);

  if (error) {
    console.error("[nm-assessment] Insert error:", error.message, error.details, error.hint, { unitId, pageId, competency, elementCount: rows.length });
    return NextResponse.json(
      { error: "Failed to save assessment", detail: error.message },
      { status: 500 }
    );
  }

  // Fire-and-forget server-side moderation on comment text
  const allComments = assessments
    .filter((a) => a.comment)
    .map((a) => a.comment)
    .join(" ");
  if (allComments.trim()) {
    moderateAndLog(allComments, {
      studentId,
      classId: classId || '',
      source: "student_progress" as const,
    }).catch((err) => console.error("[nm-assessment] moderation error:", err));
  }

  return NextResponse.json({ success: true, count: rows.length });
}
