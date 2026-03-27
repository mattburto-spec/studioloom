import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/teacher/class-profiles?classId=xxx
 *
 * Returns aggregated student learning profiles for a class.
 * Used by the teacher class profile overview component.
 *
 * Returns:
 * - students: individual profiles with display_name, ell_level, learning_profile
 * - summary: aggregated stats (language distribution, confidence distribution, etc.)
 */
export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId required" }, { status: 400 });
  }

  // Auth: verify teacher
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get students in this class via junction table
  const { data: enrollments, error: enrollError } = await admin
    .from("class_students")
    .select("student_id")
    .eq("class_id", classId);

  if (enrollError) {
    console.error("[class-profiles] Enrollment query failed:", enrollError);
    return NextResponse.json({ error: "Failed to load class" }, { status: 500 });
  }

  const studentIds = (enrollments || []).map((e: { student_id: string }) => e.student_id);

  if (studentIds.length === 0) {
    return NextResponse.json({
      students: [],
      summary: { total: 0, profilesCompleted: 0, languages: {}, confidenceDistribution: [], workingStyles: {}, feedbackPreferences: {}, learningDifferences: {} },
    });
  }

  // Load student data
  const { data: students, error: studentError } = await admin
    .from("students")
    .select("id, display_name, username, ell_level, learning_profile")
    .in("id", studentIds);

  if (studentError) {
    console.error("[class-profiles] Student query failed:", studentError);
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
  }

  // Aggregate summary stats
  const summary = {
    total: students?.length || 0,
    profilesCompleted: 0,
    languages: {} as Record<string, number>,
    confidenceDistribution: [0, 0, 0, 0, 0] as number[], // index 0 = confidence 1, etc.
    workingStyles: { solo: 0, partner: 0, small_group: 0 } as Record<string, number>,
    feedbackPreferences: { private: 0, public: 0 } as Record<string, number>,
    learningDifferences: {} as Record<string, number>,
    multilingual: 0,
    tck: 0, // Third Culture Kids (2+ countries)
  };

  for (const student of students || []) {
    const profile = student.learning_profile;
    if (!profile) continue;

    summary.profilesCompleted++;

    // Languages
    if (profile.languages_at_home) {
      for (const lang of profile.languages_at_home) {
        summary.languages[lang] = (summary.languages[lang] || 0) + 1;
      }
      if (profile.languages_at_home.length > 1) summary.multilingual++;
    }

    // Countries
    if (profile.countries_lived_in?.length >= 2) summary.tck++;

    // Design confidence
    if (profile.design_confidence >= 1 && profile.design_confidence <= 5) {
      summary.confidenceDistribution[profile.design_confidence - 1]++;
    }

    // Working style
    if (profile.working_style && summary.workingStyles[profile.working_style] !== undefined) {
      summary.workingStyles[profile.working_style]++;
    }

    // Feedback preference
    if (profile.feedback_preference && summary.feedbackPreferences[profile.feedback_preference] !== undefined) {
      summary.feedbackPreferences[profile.feedback_preference]++;
    }

    // Learning differences
    if (profile.learning_differences) {
      for (const diff of profile.learning_differences) {
        summary.learningDifferences[diff] = (summary.learningDifferences[diff] || 0) + 1;
      }
    }
  }

  return NextResponse.json({
    students: (students || []).map((s: { id: string; display_name: string | null; username: string; ell_level: string; learning_profile: Record<string, unknown> | null }) => ({
      id: s.id,
      name: s.display_name || s.username,
      ell_level: s.ell_level,
      profile: s.learning_profile,
    })),
    summary,
  });
}
