import { NextRequest, NextResponse } from "next/server";
import { aggregateFeedback } from "@/lib/knowledge/feedback";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

/**
 * GET /api/teacher/knowledge/feedback/aggregate?lesson_profile_id={id}
 *
 * Returns aggregated feedback for a lesson profile — average ratings,
 * common patterns, timing variance, engagement distribution, pace consensus.
 *
 * This is the read-side of the feedback loop (Layer 2).
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const lessonProfileId = searchParams.get("lesson_profile_id");

  if (!lessonProfileId) {
    return NextResponse.json(
      { error: "lesson_profile_id query param required" },
      { status: 400 }
    );
  }

  try {
    const aggregated = await aggregateFeedback(lessonProfileId);

    if (!aggregated) {
      return NextResponse.json(
        { aggregated: null, message: "No feedback found for this lesson profile" },
        { status: 200 }
      );
    }

    return NextResponse.json({ aggregated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Aggregation failed: ${message}` },
      { status: 500 }
    );
  }
}
