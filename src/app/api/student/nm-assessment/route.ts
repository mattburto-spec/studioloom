import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { v4 as uuid } from "uuid";

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

export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

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

  // Get student's class_id for per-class NM config + assessment scoping
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .single();

  const classId = student?.class_id || null;

  // Get NM config: class-specific (class_units) with fallback to unit-level (units)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nmConfig: any = null;

  if (classId) {
    const { data: classUnit } = await supabase
      .from("class_units")
      .select("nm_config")
      .eq("class_id", classId)
      .eq("unit_id", unitId)
      .single();

    if (classUnit?.nm_config) {
      nmConfig = classUnit.nm_config;
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

  return NextResponse.json({ success: true, count: rows.length });
}
