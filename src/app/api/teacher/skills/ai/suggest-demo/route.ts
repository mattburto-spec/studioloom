/**
 * POST /api/teacher/skills/ai/suggest-demo
 *
 * Generate 3-5 candidate "demo of competency" lines for the supplied
 * card draft. Used by the ✨ Suggest button next to the demo field on
 * /teacher/skills/new and /edit.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { suggestDemoOfCompetency, type CardDraft } from "@/lib/skills/ai-helpers";

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
      { error: "draft.title required (give the AI something to work with)" },
      { status: 400 }
    );
  }

  try {
    const suggestions = await suggestDemoOfCompetency(draft);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[suggest-demo] error:", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
