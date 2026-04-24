/**
 * POST /api/student/skills/cards/[slug]/quiz-submit
 *
 * Body: { answers: QuizAnswer[]; time_taken_seconds?: number }
 *
 * Scores the submitted answers server-side, writes the attempt to
 * `skill_quiz_attempts`, and fires the appropriate learning_events entry
 * (skill.quiz_passed or skill.quiz_failed) so student_skill_state
 * reflects the new rank.
 *
 * Ported from /api/student/safety/badges/[badgeId]/submit — same scoring
 * contract (normalise + compare) so content migrated from safety behaves
 * identically here.
 *
 * Cooldown: if the student has a recent failed attempt within the card's
 * retake_cooldown_minutes window, submit is rejected with 429.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import type {
  QuizAnswer,
  QuizAnswerResult,
  QuizQuestion,
  QuizSubmitResponse,
} from "@/types/skills";

function normalizeAnswer(
  selected: string | string[] | number[]
): string | string[] | number[] {
  if (Array.isArray(selected) && selected.length > 0) {
    if (typeof selected[0] === "number") return selected;
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
  if (Array.isArray(normSelected) && Array.isArray(normCorrect)) {
    if (normSelected.length !== normCorrect.length) return false;
    return normSelected.every((s, i) => String(s) === String(normCorrect[i]));
  }
  return String(normSelected) === String(normCorrect);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await requireStudentAuth(request);
    if (auth.error) return auth.error;
    const studentId = auth.studentId;
    const { slug } = await params;

    const body = (await request.json()) as {
      answers?: QuizAnswer[];
      time_taken_seconds?: number;
    };
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const timeTaken =
      typeof body.time_taken_seconds === "number"
        ? body.time_taken_seconds
        : null;

    if (answers.length === 0) {
      return NextResponse.json(
        { error: "answers required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Load card
    const { data: card, error: cardError } = await admin
      .from("skill_cards")
      .select(
        "id, slug, quiz_questions, pass_threshold, retake_cooldown_minutes, is_published"
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
    const pool = (
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

    if (pool.length === 0) {
      return NextResponse.json(
        { error: "This card has no quiz." },
        { status: 400 }
      );
    }

    const passThreshold = (card.pass_threshold ?? 80) as number;
    const cooldownMinutes = (card.retake_cooldown_minutes ?? 0) as number;

    // Cooldown check: if last attempt was a fail within the cooldown window,
    // reject the submission.
    if (cooldownMinutes > 0) {
      const cutoff = new Date(
        Date.now() - cooldownMinutes * 60 * 1000
      ).toISOString();
      const { data: recentFail } = await admin
        .from("skill_quiz_attempts")
        .select("id, created_at")
        .eq("student_id", studentId)
        .eq("skill_card_id", card.id)
        .eq("passed", false)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentFail) {
        const elapsed = Math.floor(
          (Date.now() -
            new Date(recentFail.created_at as string).getTime()) /
            60000
        );
        const remaining = Math.max(0, cooldownMinutes - elapsed);
        return NextResponse.json(
          {
            error: `Please wait ${remaining} more minute${remaining === 1 ? "" : "s"} before retrying.`,
            retake_after_minutes: remaining,
          },
          { status: 429 }
        );
      }
    }

    // Score
    let correctCount = 0;
    const results: QuizAnswerResult[] = answers.map((answer) => {
      const q = pool.find((x) => x.id === answer.question_id);
      if (!q) {
        return {
          question_id: answer.question_id,
          prompt: "Unknown question",
          correct: false,
          explanation: "Question not found in pool.",
        };
      }
      const correct = answersMatch(answer.selected, q.correct_answer);
      if (correct) correctCount++;
      return {
        question_id: answer.question_id,
        prompt: q.prompt,
        correct,
        explanation: q.explanation,
      };
    });

    const score = Math.round((correctCount / answers.length) * 100);
    const passed = score >= passThreshold;

    // Attempt number (1-indexed)
    const { count: prevCount } = await admin
      .from("skill_quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("skill_card_id", card.id);
    const attemptNumber = (prevCount ?? 0) + 1;

    // Insert attempt row
    const { error: attemptError } = await admin
      .from("skill_quiz_attempts")
      .insert({
        student_id: studentId,
        skill_card_id: card.id,
        score,
        passed,
        answers,
        time_taken_seconds: timeTaken,
        attempt_number: attemptNumber,
      });
    if (attemptError) {
      console.error("[skills/quiz-submit] attempt insert error:", attemptError);
      return NextResponse.json(
        { error: "Failed to save attempt" },
        { status: 500 }
      );
    }

    // Fire learning_events. On pass → skill.quiz_passed (state advances
    // to rank 2 via student_skill_state view). On fail → skill.quiz_failed
    // (rank 1, equivalent to viewed). The view takes MAX rank, so failing
    // after a previous pass doesn't demote them.
    const { error: eventError } = await admin.from("learning_events").insert({
      student_id: studentId,
      event_type: passed ? "skill.quiz_passed" : "skill.quiz_failed",
      subject_type: "skill_card",
      subject_id: card.id,
      payload: {
        attempt_number: attemptNumber,
        score,
        pass_threshold: passThreshold,
        time_taken_seconds: timeTaken,
        card_slug: card.slug,
      },
    });
    if (eventError) {
      // Non-fatal — the attempt row is the source of truth.
      console.error(
        "[skills/quiz-submit] learning_events insert error:",
        eventError
      );
    }

    const response: QuizSubmitResponse = {
      score,
      passed,
      total: answers.length,
      correct: correctCount,
      pass_threshold: passThreshold,
      attempt_number: attemptNumber,
      results,
      retake_after_minutes: passed ? 0 : cooldownMinutes,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[skills/quiz-submit] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
