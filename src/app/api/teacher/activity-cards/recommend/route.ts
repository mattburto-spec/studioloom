// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { recommendCardsForPages } from "@/lib/activity-cards";
import type { RecommendCardsRequest } from "@/types/activity-cards";
import { requireTeacher } from "@/lib/auth/require-teacher";

/**
 * POST /api/teacher/activity-cards/recommend
 *
 * Auto-select the best activity cards for generated unit pages.
 * Called after page generation to suggest cards + modifiers for each page.
 *
 * Body: { pages: Record<string, { title, learningGoal, sections }>, unitContext: { topic, gradeLevel? } }
 * Returns: { recommendations: CardRecommendation[] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  const body: RecommendCardsRequest = await request.json();
  const { pages, unitContext } = body;

  if (!pages || !unitContext?.topic) {
    return NextResponse.json(
      { error: "pages and unitContext.topic are required" },
      { status: 400 }
    );
  }

  try {
    const recommendations = await recommendCardsForPages(pages, unitContext);

    return NextResponse.json({ recommendations });
  } catch (err) {
    console.error("[activity-cards/recommend] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
