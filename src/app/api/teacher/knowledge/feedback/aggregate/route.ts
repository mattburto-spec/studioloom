import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { aggregateFeedback } from "@/lib/knowledge/feedback";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

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
 * GET /api/teacher/knowledge/feedback/aggregate?lesson_profile_id={id}
 *
 * Returns aggregated feedback for a lesson profile — average ratings,
 * common patterns, timing variance, engagement distribution, pace consensus.
 *
 * This is the read-side of the feedback loop (Layer 2).
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
