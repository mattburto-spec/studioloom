/**
 * Student Gallery Rounds API
 *
 * GET /api/student/gallery/rounds
 *   List all open gallery rounds for the student's enrolled classes.
 *   Returns rounds with submission and review progress tracking.
 *
 *   Returns: Array<{
 *     id: string;
 *     unitId: string;
 *     classId: string;
 *     title: string;
 *     description: string;
 *     reviewFormat: 'comment' | 'pmi' | 'two-stars-wish' | string;
 *     minReviews: number;
 *     anonymous: boolean;
 *     deadline: string | null;
 *     hasSubmitted: boolean;
 *     reviewsCompleted: number;
 *     totalSubmissions: number;
 *   }>
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  try {
    const db = createAdminClient();

    // 1. Get student's enrolled classes via class_students junction
    const { data: enrollments, error: enrollErr } = await db
      .from("class_students")
      .select("class_id")
      .eq("student_id", studentId)
      .eq("is_active", true);

    let studentClassIds: string[] = (enrollments || []).map(
      (e: { class_id: string }) => e.class_id
    );

    if (enrollErr || studentClassIds.length === 0) {
      // Legacy fallback: try students.class_id
      const { data: student } = await db
        .from("students")
        .select("class_id")
        .eq("id", studentId)
        .maybeSingle();

      if (student?.class_id) {
        studentClassIds = [student.class_id];
      } else {
        return NextResponse.json([], {
          headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
        });
      }
    }

    // 2. Get all open rounds for student's classes
    const { data: rounds, error: roundsErr } = await db
      .from("gallery_rounds")
      .select("*")
      .in("class_id", studentClassIds)
      .eq("status", "open");

    if (roundsErr) {
      console.error("[gallery-rounds] Query error:", roundsErr);
      return NextResponse.json(
        { error: "Failed to load gallery rounds" },
        { status: 500, headers: { "Cache-Control": "private" } }
      );
    }

    if (!rounds || rounds.length === 0) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
      });
    }

    const roundIds = rounds.map((r: any) => r.id);

    // 3. Check if student has submitted to each round (parallel query)
    const { data: submissions } = await db
      .from("gallery_submissions")
      .select("round_id")
      .eq("student_id", studentId)
      .in("round_id", roundIds);

    const submittedRoundIds = new Set(
      (submissions || []).map((s: any) => s.round_id)
    );

    // 4. Count reviews completed per round
    const { data: reviews } = await db
      .from("gallery_reviews")
      .select("round_id")
      .eq("reviewer_id", studentId)
      .in("round_id", roundIds);

    const reviewsByRound = new Map<string, number>();
    (reviews || []).forEach((r: any) => {
      reviewsByRound.set(r.round_id, (reviewsByRound.get(r.round_id) || 0) + 1);
    });

    // 5. Count total submissions per round
    const { data: submissionCounts } = await db
      .from("gallery_submissions")
      .select("round_id")
      .in("round_id", roundIds);

    const submissionsByRound = new Map<string, number>();
    (submissionCounts || []).forEach((s: any) => {
      submissionsByRound.set(
        s.round_id,
        (submissionsByRound.get(s.round_id) || 0) + 1
      );
    });

    // 6. Transform rounds for response
    const response = rounds.map((round: any) => ({
      id: round.id,
      unitId: round.unit_id,
      classId: round.class_id,
      title: round.title,
      description: round.description,
      reviewFormat: round.review_format,
      minReviews: round.min_reviews,
      anonymous: round.anonymous,
      deadline: round.deadline,
      hasSubmitted: submittedRoundIds.has(round.id),
      reviewsCompleted: reviewsByRound.get(round.id) || 0,
      totalSubmissions: submissionsByRound.get(round.id) || 0,
    }));

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[gallery-rounds] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "private" } }
    );
  }
}
