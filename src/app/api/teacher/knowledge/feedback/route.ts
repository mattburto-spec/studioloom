import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

// Phase 0.4 (10 Apr 2026): POST re-quarantined because its fire-and-forget
// updateQualityFromFeedback() call writes to the legacy knowledge_chunks
// table. GET kept — it reads lesson_feedback (separate table, not in scope).
// See docs/quarantine.md.
const QUARANTINE_RESPONSE = NextResponse.json(
  {
    error:
      "Legacy knowledge feedback quarantined — use /api/teacher/knowledge/ingest (Dimensions3). See docs/quarantine.md",
  },
  { status: 410 }
);

/**
 * POST: Submit post-lesson feedback.
 *
 * Supports two feedback types:
 * - "teacher" — 60-second teacher reflection (TeacherPostLessonFeedback)
 * - "student" — 30-second student pulse (StudentPostLessonFeedback)
 *
 * Body: {
 *   feedback_type: "teacher" | "student";
 *   lesson_profile_id: string;
 *   unit_id?: string;
 *   page_id?: string;
 *   class_id?: string;
 *   feedback_data: TeacherPostLessonFeedback | StudentPostLessonFeedback;
 * }
 */
export async function POST(_request: NextRequest) {
  return QUARANTINE_RESPONSE;
}

/**
 * GET: List feedback for a lesson profile.
 *
 * Query params:
 * - lesson_profile_id (required)
 * - feedback_type (optional: "teacher" | "student")
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const lessonProfileId = searchParams.get("lesson_profile_id");
  const feedbackType = searchParams.get("feedback_type");

  if (!lessonProfileId) {
    return NextResponse.json(
      { error: "lesson_profile_id query param required" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  let query = supabaseAdmin
    .from("lesson_feedback")
    .select("id, lesson_profile_id, teacher_id, unit_id, page_id, class_id, feedback_type, feedback_data, created_at")
    .eq("lesson_profile_id", lessonProfileId)
    .order("created_at", { ascending: false });

  if (feedbackType) {
    query = query.eq("feedback_type", feedbackType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch feedback: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ feedback: data || [] });
}
