import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { updateQualityFromFeedback } from "@/lib/knowledge/feedback";

const QUARANTINE_RESPONSE = NextResponse.json({ error: "Knowledge pipeline quarantined — pending architecture rebuild. See docs/quarantine.md" }, { status: 410 });

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
export async function POST(request: NextRequest) {
  return QUARANTINE_RESPONSE;
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const body = await request.json();
  const {
    feedback_type,
    lesson_profile_id,
    unit_id,
    page_id,
    class_id,
    feedback_data,
  } = body;

  if (!feedback_type || !["teacher", "student"].includes(feedback_type)) {
    return NextResponse.json(
      { error: "feedback_type must be 'teacher' or 'student'" },
      { status: 400 }
    );
  }

  if (!lesson_profile_id && !unit_id) {
    return NextResponse.json(
      { error: "lesson_profile_id or unit_id is required" },
      { status: 400 }
    );
  }

  if (!feedback_data) {
    return NextResponse.json(
      { error: "feedback_data is required" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  // Verify the lesson profile exists (only if provided)
  if (lesson_profile_id) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("lesson_profiles")
      .select("id")
      .eq("id", lesson_profile_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Lesson profile not found" },
        { status: 404 }
      );
    }
  }

  // Insert feedback
  const { data: row, error: insertError } = await supabaseAdmin
    .from("lesson_feedback")
    .insert({
      lesson_profile_id: lesson_profile_id || null,
      teacher_id: teacherId,
      unit_id: unit_id || null,
      page_id: page_id || null,
      class_id: class_id || null,
      feedback_type,
      feedback_data,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("[feedback] Insert failed:", insertError.message);
    return NextResponse.json(
      { error: `Failed to submit feedback: ${insertError.message}` },
      { status: 500 }
    );
  }

  // Fire-and-forget: update chunk quality scores based on feedback
  if (unit_id) {
    updateQualityFromFeedback(unit_id, feedback_type, feedback_data).catch(() => {
      // Non-critical — quality re-scoring should never block the response
    });
  }

  return NextResponse.json({
    feedbackId: row.id,
    createdAt: row.created_at,
  });
}

/**
 * GET: List feedback for a lesson profile.
 *
 * Query params:
 * - lesson_profile_id (required)
 * - feedback_type (optional: "teacher" | "student")
 */
export async function GET(request: NextRequest) {
  return QUARANTINE_RESPONSE;
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
