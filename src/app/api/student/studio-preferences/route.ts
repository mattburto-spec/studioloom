import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { MENTOR_IDS, type MentorId } from "@/lib/student/mentors";
import { THEME_IDS, type ThemeId } from "@/lib/student/themes";

const CACHE_HEADERS = { "Cache-Control": "private, no-cache, no-store, must-revalidate" };

/**
 * GET /api/student/studio-preferences
 * Returns mentor_id and theme_id for the current student.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("mentor_id, theme_id")
    .eq("id", auth.studentId)
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
 * Body: { mentor_id: "kit"|"sage"|"spark", theme_id: "clean"|"bold"|"warm"|"dark" }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { mentor_id, theme_id } = body;

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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("students")
    .update({ mentor_id, theme_id })
    .eq("id", auth.studentId);

  if (error) {
    console.error("[studio-preferences] Save failed:", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
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
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const updates: Record<string, string> = {};

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

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("students")
    .update(updates)
    .eq("id", auth.studentId);

  if (error) {
    console.error("[studio-preferences] Update failed:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...updates }, { headers: CACHE_HEADERS });
}
