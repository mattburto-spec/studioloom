// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { MENTOR_IDS, type MentorId } from "@/lib/student/mentors";
import { THEME_IDS, type ThemeId } from "@/lib/student/themes";

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };

/**
 * GET /api/student/studio-preferences
 * Returns mentor_id and theme_id for the current student.
 */
export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("mentor_id, theme_id")
    .eq("id", session.studentId)
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }

  return NextResponse.json(
    { mentor_id: data?.mentor_id ?? null, theme_id: data?.theme_id ?? null },
    { headers: CACHE_HEADERS }
  );
}

/**
 * POST /api/student/studio-preferences
 * Saves mentor + theme selection from onboarding.
 * Can be called multiple times (students can change in settings).
 *
 * Body: {
 *   mentor_id: "kit"|"sage"|"spark",
 *   theme_id: "clean"|"bold"|"warm"|"dark",
 *   onboarding_picks?: string[]  // v1 visual-picks tile IDs, feeds v2 rematch
 * }
 */
export async function POST(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { mentor_id, theme_id, onboarding_picks } = body;

  // Validate mentor_id
  if (!mentor_id || !MENTOR_IDS.includes(mentor_id as MentorId)) {
    return NextResponse.json(
      { error: `Invalid mentor_id. Must be one of: ${MENTOR_IDS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate theme_id
  if (!theme_id || !THEME_IDS.includes(theme_id as ThemeId)) {
    return NextResponse.json(
      { error: `Invalid theme_id. Must be one of: ${THEME_IDS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate optional onboarding_picks: array of short string IDs.
  // Cap at 10 entries / 32 chars each as a defensive bound on JSONB size.
  if (onboarding_picks !== undefined) {
    if (
      !Array.isArray(onboarding_picks) ||
      onboarding_picks.length > 10 ||
      !onboarding_picks.every(
        (id) => typeof id === "string" && id.length > 0 && id.length <= 32
      )
    ) {
      return NextResponse.json(
        { error: "onboarding_picks must be an array of up to 10 short string IDs" },
        { status: 400 }
      );
    }
  }

  const supabase = createAdminClient();

  // Required write — mentor_id + theme_id. Onboarding can't proceed without these.
  const { error } = await supabase
    .from("students")
    .update({ mentor_id, theme_id })
    .eq("id", session.studentId);

  if (error) {
    console.error("[studio-preferences] Save failed:", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }

  // Opportunistic write — onboarding_picks (migration 20260504225635). If
  // the column doesn't exist yet (migration not applied), log and continue
  // so onboarding still completes. The picks just don't get persisted for
  // pre-migration writes; v2 rematch falls back to last-known mentor.
  if (onboarding_picks !== undefined && onboarding_picks.length > 0) {
    const { error: picksError } = await supabase
      .from("students")
      .update({ onboarding_picks })
      .eq("id", session.studentId);
    if (picksError) {
      console.warn(
        "[studio-preferences] onboarding_picks save skipped (migration may not be applied):",
        picksError.message
      );
    }
  }

  return NextResponse.json(
    { success: true, mentor_id, theme_id },
    { headers: CACHE_HEADERS }
  );
}

/**
 * PATCH /api/student/studio-preferences
 * Update individual preferences (e.g., just theme or just mentor).
 */
export async function PATCH(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const updates: Record<string, string | boolean> = {};

  if (body.mentor_id !== undefined) {
    if (!MENTOR_IDS.includes(body.mentor_id as MentorId)) {
      return NextResponse.json({ error: "Invalid mentor_id" }, { status: 400 });
    }
    updates.mentor_id = body.mentor_id;
  }

  if (body.theme_id !== undefined) {
    if (!THEME_IDS.includes(body.theme_id as ThemeId)) {
      return NextResponse.json({ error: "Invalid theme_id" }, { status: 400 });
    }
    updates.theme_id = body.theme_id;
  }

  // Preflight Phase 1B-2-5: opt-in/out of fabrication status emails.
  // Maps to students.fabrication_notify_email (migration 100, default true).
  if (body.fabricationNotifyEmail !== undefined) {
    if (typeof body.fabricationNotifyEmail !== "boolean") {
      return NextResponse.json(
        { error: "fabricationNotifyEmail must be a boolean" },
        { status: 400 }
      );
    }
    updates.fabrication_notify_email = body.fabricationNotifyEmail;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("students")
    .update(updates)
    .eq("id", session.studentId);

  if (error) {
    console.error("[studio-preferences] Update failed:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...updates }, { headers: CACHE_HEADERS });
}
