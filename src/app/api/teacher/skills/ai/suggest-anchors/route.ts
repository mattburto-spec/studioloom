/**
 * POST /api/teacher/skills/ai/suggest-anchors
 *
 * Map the supplied card draft to 1-3 framework anchors (ATL / CASEL /
 * WEF / Studio Habits).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import {
  suggestFrameworkAnchors,
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
    const anchors = await suggestFrameworkAnchors(draft);
    return NextResponse.json({ anchors });
  } catch (err) {
    console.error("[suggest-anchors] error:", err);
    return NextResponse.json(
      { error: "Failed to generate anchors" },
      { status: 500 }
    );
  }
}
