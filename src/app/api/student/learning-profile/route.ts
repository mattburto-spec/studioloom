// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/student/learning-profile
 * Returns the student's learning profile (intake survey data).
 * Returns { profile: null } if not yet completed.
 */
export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("learning_profile")
    .eq("id", session.studentId)
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: data?.learning_profile ?? null });
}

/**
 * POST /api/student/learning-profile
 * Saves the 6-question intake survey. Can only be set once (won't overwrite existing).
 *
 * Body: {
 *   languages_at_home: string[],
 *   countries_lived_in: string[],
 *   design_confidence: 1|2|3|4|5,
 *   working_style: "solo"|"partner"|"small_group",
 *   feedback_preference: "private"|"public",
 *   learning_differences: string[]
 * }
 *
 * Research basis: docs/research/student-influence-factors.md
 * - Languages → ELL scaffolding tier (d=moderate)
 * - Countries → cultural framing, TCK strengths
 * - Design confidence → self-efficacy (d=0.92, highest effect size)
 * - Working style → collectivist/individualist signal (d=0.35)
 * - Feedback preference → relationship quality channel (d=0.57)
 * - Learning differences → UDL accommodation (optional, never shared with peers)
 */
export async function POST(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const {
    languages_at_home,
    countries_lived_in,
    design_confidence,
    working_style,
    feedback_preference,
    learning_differences,
  } = body;

  // Validate required fields
  if (!Array.isArray(languages_at_home) || languages_at_home.length === 0) {
    return NextResponse.json({ error: "At least one language required" }, { status: 400 });
  }
  if (!Array.isArray(countries_lived_in)) {
    return NextResponse.json({ error: "Countries must be an array" }, { status: 400 });
  }
  if (![1, 2, 3, 4, 5].includes(design_confidence)) {
    return NextResponse.json({ error: "Design confidence must be 1-5" }, { status: 400 });
  }
  if (!["solo", "partner", "small_group"].includes(working_style)) {
    return NextResponse.json({ error: "Working style must be solo, partner, or small_group" }, { status: 400 });
  }
  if (feedback_preference !== "private" && feedback_preference !== "public") {
    return NextResponse.json({ error: "Feedback preference must be private or public" }, { status: 400 });
  }

  // learning_differences is optional — default to empty array
  const validDiffs = ["adhd", "dyslexia", "dyscalculia", "autism", "anxiety", "other"];
  const safeDiffs = Array.isArray(learning_differences)
    ? learning_differences.filter((d: string) => validDiffs.includes(d))
    : [];

  // Sanitize
  const profile = {
    languages_at_home: languages_at_home.slice(0, 10).map((l: string) => String(l).trim().slice(0, 50)),
    countries_lived_in: countries_lived_in.slice(0, 15).map((c: string) => String(c).trim().slice(0, 50)),
    design_confidence,
    working_style,
    feedback_preference,
    learning_differences: safeDiffs,
    collected_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();

  // Check if profile already exists (don't overwrite)
  const { data: existing } = await supabase
    .from("students")
    .select("learning_profile")
    .eq("id", session.studentId)
    .single();

  if (existing?.learning_profile) {
    return NextResponse.json({ error: "Profile already completed", profile: existing.learning_profile }, { status: 409 });
  }

  const { error } = await supabase
    .from("students")
    .update({ learning_profile: profile })
    .eq("id", session.studentId);

  if (error) {
    console.error("[learning-profile] Save failed:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, profile },
    { headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" } }
  );
}

/**
 * PATCH /api/student/learning-profile
 * Allows updating specific profile fields after initial creation.
 * Currently used for: updating learning_differences (student may want to add/remove later).
 */
export async function PATCH(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const supabase = createAdminClient();

  // Load existing profile
  const { data: existing } = await supabase
    .from("students")
    .select("learning_profile")
    .eq("id", session.studentId)
    .single();

  if (!existing?.learning_profile) {
    return NextResponse.json({ error: "No profile to update — complete the survey first" }, { status: 404 });
  }

  // Merge allowed updates
  const updated = { ...existing.learning_profile };

  if (body.learning_differences !== undefined) {
    const validDiffs = ["adhd", "dyslexia", "dyscalculia", "autism", "anxiety", "other"];
    updated.learning_differences = Array.isArray(body.learning_differences)
      ? body.learning_differences.filter((d: string) => validDiffs.includes(d))
      : [];
  }

  if (body.feedback_preference && ["private", "public"].includes(body.feedback_preference)) {
    updated.feedback_preference = body.feedback_preference;
  }

  if (body.working_style && ["solo", "partner", "small_group"].includes(body.working_style)) {
    updated.working_style = body.working_style;
  }

  updated.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("students")
    .update({ learning_profile: updated })
    .eq("id", session.studentId);

  if (error) {
    console.error("[learning-profile] Update failed:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, profile: updated },
    { headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" } }
  );
}
