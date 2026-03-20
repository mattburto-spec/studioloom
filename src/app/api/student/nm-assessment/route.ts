import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
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
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Validate session
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Check rate limit
  if (!checkRateLimit(session.student_id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded (10 per minute)" },
      { status: 429 }
    );
  }

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

  // Get the unit to determine competency
  const { data: unit } = await supabase
    .from("units")
    .select("nm_config")
    .eq("id", unitId)
    .single();

  if (!unit || !unit.nm_config) {
    return NextResponse.json({ error: "Unit not found or NM not configured" }, { status: 404 });
  }

  const nmConfig = unit.nm_config;
  const competency = nmConfig.competencies?.[0]; // Use primary competency

  if (!competency) {
    return NextResponse.json(
      { error: "No competency configured for unit" },
      { status: 400 }
    );
  }

  // Insert rows into competency_assessments
  const rows = assessments.map((a) => ({
    id: uuid(),
    student_id: session.student_id,
    unit_id: unitId,
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
    console.error("[nm-assessment] Insert error:", error);
    return NextResponse.json(
      { error: "Failed to save assessment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, count: rows.length });
}
