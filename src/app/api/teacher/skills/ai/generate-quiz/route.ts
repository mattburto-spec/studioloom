/**
 * POST /api/teacher/skills/ai/generate-quiz
 *
 * Generate N quiz questions from the supplied card draft. Uses Sonnet
 * + structured tool output. Returns QuizQuestion[] in the shape stored
 * on `skill_cards.quiz_questions`.
 *
 * Body: { draft: CardDraft, count?: number, mix?: "mostly_mc"|"mostly_tf"|"balanced" }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import {
  generateQuizQuestions,
  type CardDraft,
  type GenerateQuizOptions,
} from "@/lib/skills/ai-helpers";
import { validateQuizQuestions } from "@/lib/skills/validate-quiz";

export async function POST(req: NextRequest) {
  const auth = await requireTeacherAuth(req);
  if ("error" in auth) return auth.error;

  let payload: { draft?: CardDraft; count?: number; mix?: GenerateQuizOptions["mix"] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draft = payload?.draft;
  if (!draft?.title || typeof draft.title !== "string") {
    return NextResponse.json(
      { error: "draft.title required" },
      { status: 400 }
    );
  }
  if (!draft.body || draft.body.length === 0) {
    return NextResponse.json(
      {
        error:
          "draft.body required — generate quiz needs body content to draw questions from",
      },
      { status: 400 }
    );
  }

  const count =
    typeof payload.count === "number" && payload.count > 0
      ? Math.min(payload.count, 10)
      : 6;
  const mix: GenerateQuizOptions["mix"] = payload.mix ?? "mostly_mc";

  try {
    const questions = await generateQuizQuestions(draft, { count, mix });

    // Defensive — run the same validator the POST/PATCH routes use, so we
    // never return shapes that would fail to save. If validation fails we
    // still return what we got so the teacher can hand-edit, but flagged.
    const validationError = validateQuizQuestions(questions);
    if (validationError) {
      console.warn(
        "[generate-quiz] validation warning:",
        validationError,
        "— returning anyway for teacher review"
      );
    }
    return NextResponse.json({ questions, validation_warning: validationError });
  } catch (err) {
    console.error("[generate-quiz] error:", err);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
