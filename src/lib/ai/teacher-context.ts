/**
 * Teacher Context Helper (Layer 1 Enhancement)
 *
 * Fetches the teacher's school context, preferences, and converts to
 * PartialTeachingContext for injection into generation prompts.
 *
 * This bridges the gap between analysis-time context (which uses
 * buildTeachingContextBlock from analysis-prompts.ts) and generation-time
 * context (which was previously missing).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { PartialTeachingContext } from "@/types/lesson-intelligence";

/**
 * Fetch teaching context for a teacher by user ID.
 *
 * Queries teacher_profiles table and maps to PartialTeachingContext.
 * Returns null if no profile exists (graceful degradation).
 *
 * Results are intentionally NOT cached — this runs once per generation
 * request and the data could change between requests.
 */
export async function getTeachingContext(
  teacherId: string
): Promise<PartialTeachingContext | null> {
  try {
    const supabaseAdmin = createAdminClient();

    const { data: profile, error } = await supabaseAdmin
      .from("teacher_profiles")
      .select(
        "school_name, country, curriculum_framework, typical_period_minutes, subjects_taught, grade_levels_taught, school_context, teacher_preferences"
      )
      .eq("user_id", teacherId)
      .single();

    if (error || !profile) return null;

    const ctx: PartialTeachingContext = {};

    // Top-level fields
    if (profile.school_name) ctx.schoolName = profile.school_name;
    if (profile.country) ctx.country = profile.country;
    if (profile.curriculum_framework) ctx.curriculumFramework = profile.curriculum_framework;
    if (profile.typical_period_minutes) ctx.typicalPeriodMinutes = profile.typical_period_minutes;
    if (profile.subjects_taught) ctx.subjectsTaught = profile.subjects_taught;
    if (profile.grade_levels_taught) ctx.gradeLevelsTaught = profile.grade_levels_taught;

    // JSONB school context (deep school details)
    if (profile.school_context && typeof profile.school_context === "object") {
      ctx.schoolContext = profile.school_context as PartialTeachingContext["schoolContext"];
    }

    // JSONB teacher preferences
    if (profile.teacher_preferences && typeof profile.teacher_preferences === "object") {
      ctx.teacherPreferences = profile.teacher_preferences as PartialTeachingContext["teacherPreferences"];
    }

    return ctx;
  } catch (err) {
    console.warn("[teacher-context] Failed to fetch teaching context:", err);
    return null;
  }
}

/**
 * Extract curriculum framework from a PartialTeachingContext.
 * Returns undefined if not set.
 */
export function getFrameworkFromContext(
  ctx?: PartialTeachingContext | null
): string | undefined {
  if (!ctx) return undefined;
  return ctx.curriculumFramework || ctx.schoolContext?.curriculum_framework || undefined;
}
