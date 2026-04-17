import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { verifyTeacherHasUnit } from "@/lib/auth/verify-teacher-unit";
import type { GalleryRound, GalleryRoundWithStats } from "@/types";

function getAuthClient(request: NextRequest) {
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
 * GET /api/teacher/gallery?unitId={id}&classId={id}
 *
 * List gallery rounds for a unit+class combination.
 * Returns rounds with submission counts and review stats.
 *
 * Query params:
 *   - unitId (required): Unit ID
 *   - classId (required): Class ID
 *
 * Returns: { rounds: GalleryRound[] }
 */
export const GET = withErrorHandler("teacher/gallery:GET", async (request: NextRequest) => {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");
  const classId = searchParams.get("classId");

  if (!unitId || !classId) {
    return NextResponse.json({ error: "unitId and classId are required" }, { status: 400 });
  }

  // Verify teacher owns the unit
  const { hasAccess } = await verifyTeacherHasUnit(user.id, unitId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Fetch all gallery rounds for this unit+class
  const { data: rounds, error } = await db
    .from("gallery_rounds")
    .select("id, unit_id, class_id, teacher_id, title, description, page_ids, review_format, min_reviews, anonymous, deadline, status, display_mode, created_at, updated_at")
    .eq("unit_id", unitId)
    .eq("class_id", classId)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[gallery:GET] Query error:", error);
    return NextResponse.json({ error: "Failed to fetch gallery rounds" }, { status: 500 });
  }

  // For each round, fetch submission count and review stats
  const roundsWithStats = await Promise.all(
    (rounds || []).map(async (round: GalleryRound) => {
      const { count: submissionCount } = await db
        .from("gallery_submissions")
        .select("*", { count: "exact", head: true })
        .eq("round_id", round.id);

      return {
        ...round,
        submission_count: submissionCount || 0,
      };
    })
  );

  return NextResponse.json({ rounds: roundsWithStats }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
});

/**
 * POST /api/teacher/gallery
 *
 * Create a new gallery round for a unit+class.
 *
 * Body: {
 *   unitId: string,
 *   classId: string,
 *   title: string,
 *   description?: string,
 *   pageIds: string[],
 *   reviewFormat: 'comment' | 'pmi' | 'two-stars-wish' | toolId,
 *   minReviews: number (default 3),
 *   anonymous: boolean (default true),
 *   deadline?: string (ISO 8601)
 * }
 *
 * Returns: { round: GalleryRound }
 */
export const POST = withErrorHandler("teacher/gallery:POST", async (request: NextRequest) => {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    unitId,
    classId,
    title,
    description = "",
    pageIds,
    reviewFormat = "comment",
    displayMode = "grid",
    minReviews = 3,
    anonymous = true,
    deadline,
  } = body as {
    unitId: string;
    classId: string;
    title: string;
    description?: string;
    pageIds: string[];
    reviewFormat?: string;
    displayMode?: "grid" | "canvas";
    minReviews?: number;
    anonymous?: boolean;
    deadline?: string;
  };

  // Validate required fields
  if (!unitId || !classId || !title || !pageIds || pageIds.length === 0) {
    return NextResponse.json(
      { error: "unitId, classId, title, and non-empty pageIds are required" },
      { status: 400 }
    );
  }

  if (displayMode !== "grid" && displayMode !== "canvas") {
    return NextResponse.json(
      { error: "displayMode must be 'grid' or 'canvas'" },
      { status: 400 }
    );
  }

  // Verify teacher owns the unit
  const { hasAccess } = await verifyTeacherHasUnit(user.id, unitId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const db = createAdminClient();

  // Insert new gallery round
  const { data: round, error } = await db
    .from("gallery_rounds")
    .insert({
      unit_id: unitId,
      class_id: classId,
      teacher_id: user.id,
      title,
      description,
      page_ids: pageIds,
      review_format: reviewFormat,
      display_mode: displayMode,
      min_reviews: Math.max(1, minReviews),
      anonymous,
      status: "open",
      deadline: deadline ? new Date(deadline).toISOString() : null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[gallery:POST] Insert error:", error);
    return NextResponse.json({ error: "Failed to create gallery round" }, { status: 500 });
  }

  const response = NextResponse.json({ round }, { status: 201 });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return response;
});
