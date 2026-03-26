/**
 * Student Gallery Review Submit API
 *
 * POST /api/student/gallery/review
 *   Submit a peer review for a submission in a gallery round.
 *   One review per student per submission (unique constraint enforced by DB).
 *
 *   Body: {
 *     submissionId: string;
 *     roundId: string;
 *     reviewData: JSONB;  // format-specific review data (comment, PMI, etc.)
 *   }
 *
 *   Returns: {
 *     reviewId: string;
 *     createdAt: string;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  // Rate limit: 20 reviews/min per student (more generous than submission limit)
  const rateLimitResult = rateLimit(
    `gallery-review:${studentId}`,
    [{ maxRequests: 20, windowMs: 60 * 1000 }]
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "private",
          "Retry-After": String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)),
        },
      }
    );
  }

  const body = await request.json();
  const { submissionId, roundId, reviewData } = body;

  if (!submissionId || !roundId) {
    return NextResponse.json(
      { error: "submissionId and roundId are required" },
      { status: 400, headers: { "Cache-Control": "private" } }
    );
  }

  if (!reviewData || typeof reviewData !== "object") {
    return NextResponse.json(
      { error: "reviewData (JSONB) is required and must be an object" },
      { status: 400, headers: { "Cache-Control": "private" } }
    );
  }

  try {
    const db = createAdminClient();

    // 1. Get the submission and its student
    const { data: submission, error: submissionErr } = await db
      .from("gallery_submissions")
      .select("id, round_id, student_id")
      .eq("id", submissionId)
      .eq("round_id", roundId)
      .maybeSingle();

    if (submissionErr || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404, headers: { "Cache-Control": "private" } }
      );
    }

    // 2. Prevent self-review: can't review your own submission
    if (submission.student_id === studentId) {
      return NextResponse.json(
        { error: "You cannot review your own submission" },
        { status: 400, headers: { "Cache-Control": "private" } }
      );
    }

    // 3. Get the round to verify it's open
    const { data: round, error: roundErr } = await db
      .from("gallery_rounds")
      .select("id, class_id, status, deadline")
      .eq("id", roundId)
      .maybeSingle();

    if (roundErr || !round) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404, headers: { "Cache-Control": "private" } }
      );
    }

    if (round.status !== "open") {
      return NextResponse.json(
        { error: "This gallery round is closed" },
        { status: 400, headers: { "Cache-Control": "private" } }
      );
    }

    if (round.deadline && new Date(round.deadline) < new Date()) {
      return NextResponse.json(
        { error: "Review deadline has passed" },
        { status: 400, headers: { "Cache-Control": "private" } }
      );
    }

    // 4. Verify reviewer is enrolled in the round's class
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

    // 5. Check if review already exists (unique constraint: submission_id + reviewer_id)
    const { data: existing } = await db
      .from("gallery_reviews")
      .select("id")
      .eq("submission_id", submissionId)
      .eq("reviewer_id", studentId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this submission" },
        { status: 400, headers: { "Cache-Control": "private" } }
      );
    }

    // 6. Insert review
    const { data: review, error: insertErr } = await db
      .from("gallery_reviews")
      .insert({
        submission_id: submissionId,
        round_id: roundId,
        reviewer_id: studentId,
        review_data: reviewData,
      })
      .select("id, created_at")
      .single();

    if (insertErr) {
      console.error("[gallery-review] Insert failed:", insertErr);
      return NextResponse.json(
        { error: "Failed to save review" },
        { status: 500, headers: { "Cache-Control": "private" } }
      );
    }

    return NextResponse.json(
      {
        reviewId: review.id,
        createdAt: review.created_at,
      },
      { headers: { "Cache-Control": "private" } }
    );
  } catch (error) {
    console.error("[gallery-review] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "private" } }
    );
  }
}
