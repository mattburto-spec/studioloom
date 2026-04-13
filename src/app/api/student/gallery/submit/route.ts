/**
 * Student Gallery Submit API
 *
 * POST /api/student/gallery/submit
 *   Submit work to a gallery round. Only one submission per student per round allowed.
 *   Validates that the round is open and deadline has not passed.
 *   Rate limited: 5 submissions per minute.
 *
 *   Body: {
 *     roundId: string;
 *     contextNote?: string;  // optional context about the work
 *     content: JSONB;        // snapshot of student's portfolio work
 *   }
 *
 *   Returns: {
 *     submissionId: string;
 *     createdAt: string;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { rateLimit } from "@/lib/rate-limit";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";

export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  // Rate limit: 5 submissions/min per student
  const rateLimitResult = rateLimit(
    `gallery-submit:${studentId}`,
    [{ maxRequests: 5, windowMs: 60 * 1000 }]
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
  const { roundId, contextNote = "", content } = body;

  if (!roundId) {
    return NextResponse.json(
      { error: "roundId is required" },
      { status: 400, headers: { "Cache-Control": "private" } }
    );
  }

  if (!content || typeof content !== "object") {
    return NextResponse.json(
      { error: "content (JSONB) is required and must be an object" },
      { status: 400, headers: { "Cache-Control": "private" } }
    );
  }

  try {
    const db = createAdminClient();

    // 1. Get the round and verify it's open + deadline not passed
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
        { error: "Submission deadline has passed" },
        { status: 400, headers: { "Cache-Control": "private" } }
      );
    }

    // 2. Verify student is enrolled in the round's class (via class_students)
    const { data: enrollment, error: enrollErr } = await db
      .from("class_students")
      .select("id")
      .eq("student_id", studentId)
      .eq("class_id", round.class_id)
      .eq("is_active", true)
      .maybeSingle();

    if (enrollErr || !enrollment) {
      // Try legacy fallback
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

    // 3. Check if student already submitted to this round
    const { data: existing } = await db
      .from("gallery_submissions")
      .select("id")
      .eq("round_id", roundId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted to this round" },
        { status: 400, headers: { "Cache-Control": "private" } }
      );
    }

    // Phase 5F: Synchronous moderation gate — peer-visible content
    const textToModerate = contextNote || '';
    if (textToModerate.length > 0) {
      try {
        const { allow } = await moderateAndLog(textToModerate, {
          classId: round.class_id || '',
          studentId,
          source: 'gallery_post' as const,
        }, { gate: true });
        if (!allow) {
          return NextResponse.json(
            { error: "This content can't be shared right now. Please revise and try again." },
            { status: 403, headers: { "Cache-Control": "private" } }
          );
        }
      } catch (modErr) {
        // Moderation failure → allow through (defence in depth, teacher reviews pending)
        console.error('[gallery-submit] moderation failed, allowing through:', modErr);
      }
    }

    // 4. Insert submission
    const { data: submission, error: insertErr } = await db
      .from("gallery_submissions")
      .insert({
        round_id: roundId,
        student_id: studentId,
        context_note: contextNote,
        content,
      })
      .select("id, created_at")
      .single();

    if (insertErr) {
      console.error("[gallery-submit] Insert failed:", insertErr);
      return NextResponse.json(
        { error: "Failed to save submission" },
        { status: 500, headers: { "Cache-Control": "private" } }
      );
    }

    return NextResponse.json(
      {
        submissionId: submission.id,
        createdAt: submission.created_at,
      },
      { headers: { "Cache-Control": "private" } }
    );
  } catch (error) {
    console.error("[gallery-submit] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "private" } }
    );
  }
}
