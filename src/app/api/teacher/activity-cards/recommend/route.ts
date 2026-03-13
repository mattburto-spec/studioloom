import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { recommendCardsForPages } from "@/lib/activity-cards";
import type { RecommendCardsRequest } from "@/types/activity-cards";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

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
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
