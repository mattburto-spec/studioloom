/**
 * Submit test answers and calculate score.
 *
 * POST /api/student/safety/badges/[badgeId]/submit
 *   Body: {
 *     answers: Array<{
 *       question_id: string;
 *       selected: string | string[] | number[];
 *       time_ms: number;
 *     }>;
 *     time_taken_seconds: number;
 *   }
 *
 *   Returns: {
 *     score: number (0-100);
 *     passed: boolean;
 *     total: number;
 *     correct: number;
 *     results: Array<{
 *       question_id: string;
 *       prompt: string;
 *       correct: boolean;
 *       explanation: string;
 *     }>;
 *     badge_awarded: boolean;
 *     badge_awarded_at?: string;
 *     badge_expires_at?: string;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import * as Sentry from "@sentry/nextjs";

interface Answer {
  question_id: string;
  selected: string | string[] | number[];
  time_ms: number;
}

function normalizeAnswer(
  selected: string | string[] | number[]
): string | string[] | number[] {
  // For sequence questions, the selected value is already number[]
  if (Array.isArray(selected) && selected.length > 0) {
    if (typeof selected[0] === "number") {
      return selected;
    }
    return selected.map((s) => String(s));
  }
  return String(selected);
}

function answersMatch(
  selected: string | string[] | number[],
  correct: string | string[] | number[]
): boolean {
  const normSelected = normalizeAnswer(selected);
  const normCorrect = normalizeAnswer(correct);

  // If both are arrays (for sequence/multi-select)
  if (Array.isArray(normSelected) && Array.isArray(normCorrect)) {
    if (normSelected.length !== normCorrect.length) return false;
    return normSelected.every((s, i) => String(s) === String(normCorrect[i]));
  }

  // Single-answer comparison
  return String(normSelected) === String(normCorrect);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;
  const { badgeId } = await params;

  try {
    const body = await request.json() as {
      answers: Answer[];
      time_taken_seconds: number;
    };
    const { answers, time_taken_seconds } = body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "Invalid answers format" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch badge
    const { data: badge, error: badgeError } = await supabase
      .from("badges")
      .select("*")
      .eq("id", badgeId)
      .single();

    if (badgeError || !badge) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    // Get question pool
    const question_pool = (badge.question_pool || []) as Array<{
      id: string;
      type: string;
      prompt: string;
      topic: string;
      correct_answer: string | string[] | number[];
      explanation: string;
      difficulty: string;
    }>;

    // Score each answer
    let correct_count = 0;
    const results = answers.map((answer) => {
      const question = question_pool.find((q) => q.id === answer.question_id);
      if (!question) {
        return {
          question_id: answer.question_id,
          prompt: "Unknown question",
          correct: false,
          explanation: "Question not found",
        };
      }

      const correct = answersMatch(
        answer.selected,
        question.correct_answer
      );
      if (correct) correct_count++;

      return {
        question_id: answer.question_id,
        prompt: question.prompt,
        correct,
        explanation: question.explanation,
      };
    });

    const score = Math.round(
      (correct_count / answers.length) * 100
    );
    const passed = score >= badge.pass_threshold;

    // Insert result record
    const { data: resultData, error: insertError } = await supabase
      .from("safety_results")
      .insert({
        student_id: studentId,
        badge_id: badgeId,
        score,
        passed,
        answers: answers,
        results,
        time_taken_seconds,
      })
      .select()
      .single();

    if (insertError) {
      Sentry.captureException(insertError);
      return NextResponse.json(
        { error: "Failed to save result" },
        { status: 500 }
      );
    }

    let badge_awarded = false;
    let badge_awarded_at: string | undefined;
    let badge_expires_at: string | undefined;

    // If passed, award badge
    if (passed) {
      const now = new Date();
      const awarded_at = now.toISOString();
      let expires_at: string | null = null;

      // Calculate expiry date if applicable
      if (badge.expiry_months && badge.expiry_months > 0) {
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + badge.expiry_months);
        expires_at = expiry.toISOString();
      }

      // Check if student already has an active badge
      const { data: existingBadge } = await supabase
        .from("student_badges")
        .select("id")
        .eq("student_id", studentId)
        .eq("badge_id", badgeId)
        .eq("status", "active")
        .maybeSingle();

      if (!existingBadge) {
        // Insert new student_badge record
        const { error: badgeInsertError } = await supabase
          .from("student_badges")
          .insert({
            student_id: studentId,
            badge_id: badgeId,
            awarded_at,
            expires_at,
            score,
            status: "active",
          });

        if (badgeInsertError) {
          Sentry.captureException(badgeInsertError);
          return NextResponse.json(
            { error: "Failed to award badge" },
            { status: 500 }
          );
        }

        badge_awarded = true;
        badge_awarded_at = awarded_at;
        badge_expires_at = expires_at || undefined;
      } else {
        // Already has active badge
        badge_awarded = false;
      }
    }

    return NextResponse.json({
      score,
      passed,
      total: answers.length,
      correct: correct_count,
      results,
      badge_awarded,
      badge_awarded_at,
      badge_expires_at,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
