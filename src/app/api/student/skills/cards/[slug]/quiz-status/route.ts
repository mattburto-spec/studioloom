/**
 * GET /api/student/skills/cards/[slug]/quiz-status
 *
 * Returns cooldown + attempt history for the card's quiz. Used by the
 * runner's intro screen to decide:
 *   - show "Start quiz" button (no cooldown, not already passed)
 *   - show cooldown countdown (failed attempt within cooldown window)
 *   - show "Already passed" state (student has skill.quiz_passed)
 *
 * Doesn't return the actual questions — those come with the card body
 * on `/api/student/skills/cards/[slug]`. This endpoint is just for state.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import type { QuizQuestion, QuizStatus } from "@/types/skills";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await requireStudentAuth(request);
    if (auth.error) return auth.error;
    const studentId = auth.studentId;
    const { slug } = await params;

    const admin = createAdminClient();

    const { data: card, error: cardError } = await admin
      .from("skill_cards")
      .select(
        "id, quiz_questions, pass_threshold, retake_cooldown_minutes, question_count, is_published"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (!card.is_published) {
      return NextResponse.json({ error: "Card not available" }, { status: 404 });
    }

    const questionsRaw = card.quiz_questions;
    const questions = (
      typeof questionsRaw === "string"
        ? (() => {
            try {
              return JSON.parse(questionsRaw) as QuizQuestion[];
            } catch {
              return [];
            }
          })()
        : (questionsRaw ?? [])
    ) as QuizQuestion[];

    const effectiveCount =
      card.question_count && card.question_count > 0
        ? Math.min(card.question_count, questions.length)
        : questions.length;

    const out: QuizStatus = {
      has_quiz: questions.length > 0,
      question_count: effectiveCount,
      pass_threshold: card.pass_threshold ?? 80,
      retake_cooldown_minutes: card.retake_cooldown_minutes ?? 0,
      last_attempt_at: null,
      attempt_count: 0,
      best_score: null,
      passed: false,
      cooldown_remaining_minutes: 0,
    };

    if (!out.has_quiz) {
      return NextResponse.json(out);
    }

    // Attempt history for this student × card.
    const { data: attempts } = await admin
      .from("skill_quiz_attempts")
      .select("id, score, passed, created_at")
      .eq("student_id", studentId)
      .eq("skill_card_id", card.id)
      .order("created_at", { ascending: false });

    const rows = attempts ?? [];
    out.attempt_count = rows.length;
    out.best_score = rows.length
      ? Math.max(...rows.map((r) => r.score as number))
      : null;
    out.passed = rows.some((r) => r.passed === true);
    out.last_attempt_at = rows[0]?.created_at ?? null;

    // Cooldown: only applies to last attempt if it was a fail.
    const last = rows[0];
    if (last && !last.passed && out.retake_cooldown_minutes > 0) {
      const lastMs = new Date(last.created_at as string).getTime();
      const elapsedMinutes = Math.floor(
        (Date.now() - lastMs) / (1000 * 60)
      );
      const remaining = Math.max(
        0,
        out.retake_cooldown_minutes - elapsedMinutes
      );
      out.cooldown_remaining_minutes = remaining;
    }

    return NextResponse.json(out);
  } catch (err) {
    console.error("[skills/quiz-status] error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
