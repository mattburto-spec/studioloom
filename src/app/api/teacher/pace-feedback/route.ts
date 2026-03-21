import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/teacher/pace-feedback?unit_id={unitId}
 *
 * Returns aggregated student pace feedback per lesson page.
 * Feedback is collected after "Complete & Continue" and shows:
 * - too_slow, just_right, too_fast counts per page
 * - Helps teachers understand whether lessons match class pacing
 *
 * Returns: { pages: [{ page_id, too_slow, just_right, too_fast, total }, ...] }
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unit_id");

  if (!unitId) {
    return NextResponse.json(
      { error: "unit_id query param required" },
      { status: 400 }
    );
  }

  try {
    const db = createAdminClient();

    // Fetch all student pace feedback for this unit
    const { data: feedbackRows, error: queryError } = await db
      .from("lesson_feedback")
      .select("page_id, feedback_data")
      .eq("unit_id", unitId)
      .eq("feedback_type", "student")
      .not("feedback_data", "is", null);

    if (queryError) {
      console.error("[pace-feedback] Query error:", queryError.message);
      return NextResponse.json(
        { error: "Failed to fetch feedback" },
        { status: 500 }
      );
    }

    // Aggregate by page_id
    const pageMap = new Map<
      string,
      { too_slow: number; just_right: number; too_fast: number }
    >();

    (feedbackRows || []).forEach((row) => {
      const pageId = row.page_id;
      const pace = (row.feedback_data as Record<string, unknown>)?.pace as string | undefined;

      if (!pageId || !pace) return;

      if (!pageMap.has(pageId)) {
        pageMap.set(pageId, { too_slow: 0, just_right: 0, too_fast: 0 });
      }

      const counts = pageMap.get(pageId)!;
      if (pace === "too_slow") counts.too_slow++;
      else if (pace === "just_right") counts.just_right++;
      else if (pace === "too_fast") counts.too_fast++;
    });

    // Convert to array with page_id and total
    const pages = Array.from(pageMap.entries()).map(([pageId, counts]) => ({
      page_id: pageId,
      too_slow: counts.too_slow,
      just_right: counts.just_right,
      too_fast: counts.too_fast,
      total: counts.too_slow + counts.just_right + counts.too_fast,
    }));

    return NextResponse.json({ pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[pace-feedback] Error:", message);
    return NextResponse.json(
      { error: `Failed to aggregate pace feedback: ${message}` },
      { status: 500 }
    );
  }
}
