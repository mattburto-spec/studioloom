/**
 * Student Gallery Feedback API
 *
 * GET /api/student/gallery/feedback?roundId=<uuid>
 *   Retrieve reviews received on the student's own submission.
 *   EFFORT-GATED: students must complete min_reviews before seeing feedback.
 *
 *   Returns:
 *   - If locked (hasn't completed enough reviews):
 *     { locked: true, reviewsCompleted: number, minRequired: number }
 *
 *   - If unlocked:
 *     {
 *       locked: false,
 *       reviews: Array<{
 *         id: string;
 *         reviewData: JSONB;
 *         createdAt: string;
 *         reviewerName: string;  // "Classmate" if anonymous, actual name otherwise
 *       }>
 *     }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";

export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("roundId");

  if (!roundId) {
    return NextResponse.json(
      { error: "roundId query param is required" },
      { status: 400, headers: { "Cache-Control": "private" } }
    );
  }

  try {
    const db = createAdminClient();

    // 1. Get the round
    const { data: round, error: roundErr } = await db
      .from("gallery_rounds")
      .select("id, class_id, min_reviews, anonymous")
      .eq("id", roundId)
      .maybeSingle();

    if (roundErr || !round) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404, headers: { "Cache-Control": "private" } }
      );
    }

    // 2. Verify student is enrolled in the round's class
    const { data: enrollment, error: enrollErr } = await db
      .from("class_students")
      .select("id")
      .eq("student_id", studentId)
      .eq("class_id", round.class_id)
      .eq("is_active", true)
      .maybeSingle();

    if (enrollErr || !enrollment) {
      // Legacy fallback
      const { data: student } = await db
        .from("students")
        .select("class_id")
        .eq("id", studentId)
        .maybeSingle();

      if (student?.class_id !== round.class_id) {
        return NextResponse.json(
          { error: "Unauthorized: not in this class" },
          { status: 403, headers: { "Cache-Control": "private" } }
        );
      }
    }

    // 3. Count how many reviews the student has completed in this round
    const { data: studentReviews } = await db
      .from("gallery_reviews")
      .select("id")
      .eq("round_id", roundId)
      .eq("reviewer_id", studentId);

    const reviewsCompleted = (studentReviews || []).length;

    // 4. EFFORT-GATING: check if student has completed minimum reviews
    if (reviewsCompleted < round.min_reviews) {
      return NextResponse.json(
        {
          locked: true,
          reviewsCompleted,
          minRequired: round.min_reviews,
        },
        { headers: { "Cache-Control": "private" } }
      );
    }

    // 5. Get the student's own submission
    const { data: submission, error: submissionErr } = await db
      .from("gallery_submissions")
      .select("id")
      .eq("round_id", roundId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (submissionErr || !submission) {
      // Student hasn't submitted yet
      return NextResponse.json(
        {
          locked: false,
          reviews: [],
        },
        { headers: { "Cache-Control": "private" } }
      );
    }

    // 6. Get all reviews on the student's submission
    const { data: reviews, error: reviewsErr } = await db
      .from("gallery_reviews")
      .select("id, reviewer_id, review_data, created_at")
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: false });

    if (reviewsErr) {
      console.error("[gallery-feedback] Query error:", reviewsErr);
      return NextResponse.json(
        { error: "Failed to load feedback" },
        { status: 500, headers: { "Cache-Control": "private" } }
      );
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json(
        {
          locked: false,
          reviews: [],
        },
        { headers: { "Cache-Control": "private" } }
      );
    }

    // 7. Get reviewer names (if not anonymous)
    let reviewerNames: Record<string, string> = {};
    if (!round.anonymous) {
      const reviewerIds = reviews.map((r: any) => r.reviewer_id);
      const { data: students } = await db
        .from("students")
        .select("id, display_name")
        .in("id", reviewerIds);

      if (students) {
        students.forEach((s: any) => {
          reviewerNames[s.id] = s.display_name || s.id;
        });
      }
    }

    // 8. Transform response
    const transformedReviews = reviews.map((review: any) => ({
      id: review.id,
      reviewData: review.review_data,
      createdAt: review.created_at,
      reviewerName: round.anonymous
        ? "Classmate"
        : reviewerNames[review.reviewer_id] || "Unknown",
    }));

    return NextResponse.json(
      {
        locked: false,
        reviews: transformedReviews,
      },
      { headers: { "Cache-Control": "private" } }
    );
  } catch (error) {
    console.error("[gallery-feedback] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "private" } }
    );
  }
}
