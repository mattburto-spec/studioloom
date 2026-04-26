/**
 * POST /api/teacher/skills/ai/suggest-outcomes
 *
 * Generate 3 "Student can…" learning outcomes for the supplied card draft.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import {
  suggestLearningOutcomes,
  type CardDraft,
} from "@/lib/skills/ai-helpers";

export async function POST(req: NextRequest) {
  const auth = await requireTeacherAuth(req);
  if ("error" in auth) return auth.error;

  let draft: CardDraft;
  try {
    const body = await req.json();
    draft = body?.draft ?? body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!draft?.title || typeof draft.title !== "string") {
    return NextResponse.json(
      { error: "draft.title required" },
      { status: 400 }
    );
  }

  try {
    const suggestions = await suggestLearningOutcomes(draft);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[suggest-outcomes] error:", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
