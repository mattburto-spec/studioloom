// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

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

function extractRoundId(request: NextRequest): string {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  // /api/teacher/gallery/[roundId] → roundId is last segment
  return segments[segments.length - 1];
}

/**
 * GET /api/teacher/gallery/[roundId]
 *
 * Get a single gallery round with full monitoring data.
 */
export async function GET(request: NextRequest) {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = extractRoundId(request);
  const db = createAdminClient();

  // Fetch the gallery round
  const { data: round, error: roundError } = await db
    .from("gallery_rounds")
    .select("id, unit_id, class_id, teacher_id, title, description, review_format, min_reviews, anonymous, deadline, status, display_mode, created_at, updated_at")
    .eq("id", roundId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (roundError) {
    console.error("[gallery/[roundId]:GET] Round query error:", roundError);
    return NextResponse.json({ error: "Failed to fetch gallery round" }, { status: 500 });
  }

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  // Fetch all submissions for this round
  const { data: submissions, error: submissionsError } = await db
    .from("gallery_submissions")
    .select("id, round_id, student_id, context_note, canvas_x, canvas_y, created_at")
    .eq("round_id", roundId)
    .order("created_at", { ascending: false });

  if (submissionsError) {
    console.error("[gallery/[roundId]:GET] Submissions query error:", submissionsError);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }

  // Batch fetch student names + review counts (was N+1: 2 queries per submission)
  const submissionList = submissions || [];
  const studentIds = [...new Set(submissionList.map((s: any) => s.student_id))];
  const submissionIds = submissionList.map((s: any) => s.id);

  // 2 batch queries instead of 2N individual queries
  const [studentResult, reviewResult] = await Promise.all([
    studentIds.length > 0
      ? db.from("students").select("id, display_name").in("id", studentIds)
      : Promise.resolve({ data: [] }),
    submissionIds.length > 0
      ? db.from("gallery_reviews").select("submission_id").in("submission_id", submissionIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Build lookup maps
  const studentMap = new Map(
    (studentResult.data || []).map((s: any) => [s.id, s.display_name])
  );
  // Count reviews per submission from the flat list
  const reviewCountMap = new Map<string, number>();
  for (const r of (reviewResult.data || []) as any[]) {
    reviewCountMap.set(r.submission_id, (reviewCountMap.get(r.submission_id) || 0) + 1);
  }

  const submissionsWithDetails = submissionList.map((submission: any) => {
    const reviewCount = reviewCountMap.get(submission.id) || 0;
    return {
      id: submission.id,
      student_id: submission.student_id,
      student_name: studentMap.get(submission.student_id) || submission.student_id,
      context_note: submission.context_note,
      canvas_x: submission.canvas_x,
      canvas_y: submission.canvas_y,
      created_at: submission.created_at,
      review_count: reviewCount,
      is_complete: reviewCount >= round.min_reviews,
    };
  });

  return NextResponse.json({
    round: {
      ...round,
      submission_count: submissionsWithDetails.length,
      submissions: submissionsWithDetails,
    },
  });
}

/**
 * PATCH /api/teacher/gallery/[roundId]
 *
 * Update a gallery round (close it, change deadline, etc.).
 */
export async function PATCH(request: NextRequest) {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = extractRoundId(request);

  const body = await request.json();
  const { status, deadline, minReviews, title, description } = body as {
    status?: "open" | "closed";
    deadline?: string | null;
    minReviews?: number;
    title?: string;
    description?: string;
  };

  const db = createAdminClient();

  // Verify teacher owns this round
  const { data: round } = await db
    .from("gallery_rounds")
    .select("id")
    .eq("id", roundId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline).toISOString() : null;
  if (minReviews !== undefined) updateData.min_reviews = Math.max(1, minReviews);
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  updateData.updated_at = new Date().toISOString();

  const { data: updated, error } = await db
    .from("gallery_rounds")
    .update(updateData)
    .eq("id", roundId)
    .select("*")
    .single();

  if (error) {
    console.error("[gallery/[roundId]:PATCH] Update error:", error);
    return NextResponse.json({ error: "Failed to update gallery round" }, { status: 500 });
  }

  return NextResponse.json({ round: updated }, {
    headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
  });
}

/**
 * DELETE /api/teacher/gallery/[roundId]
 *
 * Delete a gallery round (cascades to submissions and reviews).
 */
export async function DELETE(request: NextRequest) {
  const supabase = getAuthClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = extractRoundId(request);
  const db = createAdminClient();

  // Verify teacher owns this round
  const { data: round } = await db
    .from("gallery_rounds")
    .select("id")
    .eq("id", roundId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const { error } = await db
    .from("gallery_rounds")
    .delete()
    .eq("id", roundId);

  if (error) {
    console.error("[gallery/[roundId]:DELETE] Delete error:", error);
    return NextResponse.json({ error: "Failed to delete gallery round" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, {
    headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
  });
}
