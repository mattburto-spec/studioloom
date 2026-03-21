import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST: Submit student pace feedback after completing a lesson.
 *
 * Stores pace data that feeds into the timing model for future
 * lesson generation. Aggregated pace_distribution per lesson tells
 * the system whether lessons are too fast/slow for a given class.
 *
 * Body: {
 *   unit_id: string;
 *   page_id: string;
 *   pace: "too_slow" | "just_right" | "too_fast";
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const body = await request.json();
  const { unit_id, page_id, pace } = body;

  if (!unit_id || !page_id) {
    return NextResponse.json(
      { error: "unit_id and page_id are required" },
      { status: 400 }
    );
  }

  if (!["too_slow", "just_right", "too_fast"].includes(pace)) {
    return NextResponse.json(
      { error: "pace must be 'too_slow', 'just_right', or 'too_fast'" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Store as lesson_feedback with feedback_type = "student"
  // This reuses the existing table and aggregation pipeline.
  // teacher_id is NULL for student-submitted feedback.
  const { data: row, error: insertError } = await supabase
    .from("lesson_feedback")
    .insert({
      lesson_profile_id: null,
      teacher_id: null,
      unit_id,
      page_id,
      class_id: null,
      feedback_type: "student",
      feedback_data: {
        student_id: studentId,
        submitted_at: new Date().toISOString(),
        understanding: 3, // neutral — we only collect pace
        engagement: 3,    // neutral — we only collect pace
        pace,
      },
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("[pace-feedback] Insert failed:", insertError.message);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    feedbackId: row.id,
    createdAt: row.created_at,
  });
}
