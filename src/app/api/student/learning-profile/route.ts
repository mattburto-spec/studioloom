import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/student/learning-profile
 * Returns the student's learning profile (intake survey data).
 * Returns { profile: null } if not yet completed.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("learning_profile")
    .eq("id", auth.studentId)
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: data?.learning_profile ?? null });
}

/**
 * POST /api/student/learning-profile
 * Saves the 3-question intake survey. Can only be set once (won't overwrite existing).
 * Body: { languages_at_home: string[], countries_lived_in: string[], feedback_preference: "private"|"public" }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { languages_at_home, countries_lived_in, feedback_preference } = body;

  // Validate
  if (!Array.isArray(languages_at_home) || languages_at_home.length === 0) {
    return NextResponse.json({ error: "At least one language required" }, { status: 400 });
  }
  if (!Array.isArray(countries_lived_in)) {
    return NextResponse.json({ error: "Countries must be an array" }, { status: 400 });
  }
  if (feedback_preference !== "private" && feedback_preference !== "public") {
    return NextResponse.json({ error: "Feedback preference must be 'private' or 'public'" }, { status: 400 });
  }

  // Sanitize
  const profile = {
    languages_at_home: languages_at_home.slice(0, 10).map((l: string) => String(l).trim().slice(0, 50)),
    countries_lived_in: countries_lived_in.slice(0, 15).map((c: string) => String(c).trim().slice(0, 50)),
    feedback_preference,
    collected_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();

  // Check if profile already exists (don't overwrite)
  const { data: existing } = await supabase
    .from("students")
    .select("learning_profile")
    .eq("id", auth.studentId)
    .single();

  if (existing?.learning_profile) {
    return NextResponse.json({ error: "Profile already completed", profile: existing.learning_profile }, { status: 409 });
  }

  const { error } = await supabase
    .from("students")
    .update({ learning_profile: profile })
    .eq("id", auth.studentId);

  if (error) {
    console.error("[learning-profile] Save failed:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ success: true, profile });
}
