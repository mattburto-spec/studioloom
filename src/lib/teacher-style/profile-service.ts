/**
 * Teacher Style Profile Service
 *
 * Loads, saves, and updates teacher style profiles.
 * Profiles are stored as JSONB in the teachers table.
 *
 * Passive signal collection happens here — functions that
 * extract style signals from teacher actions and accumulate
 * them into the profile.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  type TeacherStyleProfile,
  createEmptyProfile,
  computeConfidence,
} from "@/types/teacher-style";

// =========================================================================
// CRUD
// =========================================================================

/**
 * Load a teacher's style profile. Creates an empty one if none exists.
 */
export async function loadStyleProfile(
  teacherId: string
): Promise<TeacherStyleProfile> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("teachers")
    .select("style_profile")
    .eq("id", teacherId)
    .single();

  if (data?.style_profile) {
    return data.style_profile as TeacherStyleProfile;
  }

  // Create empty profile
  const profile = createEmptyProfile(teacherId);
  await saveStyleProfile(teacherId, profile);
  return profile;
}

/**
 * Save a teacher's style profile.
 */
export async function saveStyleProfile(
  teacherId: string,
  profile: TeacherStyleProfile
): Promise<void> {
  const supabase = createAdminClient();

  profile.confidenceLevel = computeConfidence(profile);
  profile.lastUpdated = new Date().toISOString();

  await supabase
    .from("teachers")
    .update({ style_profile: profile })
    .eq("id", teacherId);
}

// =========================================================================
// PASSIVE SIGNAL COLLECTION
// =========================================================================

/**
 * Signal: Teacher uploaded a lesson plan that was analysed.
 * Extracts timing patterns and phase sequences from Pass 1 results.
 */
export async function onLessonUploaded(
  teacherId: string,
  pass1Data: {
    sections: Array<{
      title: string;
      estimated_minutes: number;
      activity_type?: string;
    }>;
    estimated_duration_minutes: number;
    lesson_type: string;
  }
): Promise<void> {
  const profile = await loadStyleProfile(teacherId);

  // Update lesson length average
  const prevCount = profile.lessonPatterns.uploadCount;
  const prevAvg = profile.lessonPatterns.averageLessonLength;
  const newAvg =
    (prevAvg * prevCount + pass1Data.estimated_duration_minutes) /
    (prevCount + 1);
  profile.lessonPatterns.averageLessonLength = Math.round(newAvg);

  // Extract phase sequence
  const phases = pass1Data.sections
    .map((s) => s.activity_type || "unknown")
    .filter(Boolean);

  // Track activity type frequencies
  for (const phase of phases) {
    const existing = profile.lessonPatterns.preferredActivityTypes.find(
      (a) => a.type === phase
    );
    if (existing) {
      existing.frequency++;
    } else {
      profile.lessonPatterns.preferredActivityTypes.push({
        type: phase,
        frequency: 1,
      });
    }
  }

  // Sort by frequency
  profile.lessonPatterns.preferredActivityTypes.sort(
    (a, b) => b.frequency - a.frequency
  );

  // Calculate theory:practical ratio from sections
  let theoryMinutes = 0;
  let practicalMinutes = 0;
  for (const section of pass1Data.sections) {
    const type = (section.activity_type || "").toLowerCase();
    if (
      [
        "discussion",
        "reading",
        "analysis",
        "research",
        "documentation",
        "lecture",
        "presentation",
      ].includes(type)
    ) {
      theoryMinutes += section.estimated_minutes;
    } else {
      practicalMinutes += section.estimated_minutes;
    }
  }
  const total = theoryMinutes + practicalMinutes;
  if (total > 0) {
    const thisRatio = theoryMinutes / total;
    profile.lessonPatterns.averageTheoryPracticalRatio =
      (profile.lessonPatterns.averageTheoryPracticalRatio * prevCount +
        thisRatio) /
      (prevCount + 1);
  }

  profile.lessonPatterns.uploadCount = prevCount + 1;

  await saveStyleProfile(teacherId, profile);
}

/**
 * Signal: Teacher edited AI-generated content (timing adjustment).
 * Records the diff between AI-suggested and teacher-set timing.
 */
export async function onTimingEdited(
  teacherId: string,
  aiSuggestedMinutes: number,
  teacherSetMinutes: number
): Promise<void> {
  const profile = await loadStyleProfile(teacherId);

  const adjustment = teacherSetMinutes - aiSuggestedMinutes;
  const prevCount = profile.editPatterns.editCount;
  const prevAvg = profile.editPatterns.averageTimingAdjustment;

  profile.editPatterns.averageTimingAdjustment =
    (prevAvg * prevCount + adjustment) / (prevCount + 1);
  profile.editPatterns.editCount = prevCount + 1;

  await saveStyleProfile(teacherId, profile);
}

/**
 * Signal: Teacher created a unit.
 */
export async function onUnitCreated(teacherId: string): Promise<void> {
  const profile = await loadStyleProfile(teacherId);
  profile.totalUnitsCreated++;
  await saveStyleProfile(teacherId, profile);
}

/**
 * Signal: Teacher deleted a section from AI-generated content.
 */
export async function onSectionDeleted(
  teacherId: string,
  sectionType: string
): Promise<void> {
  const profile = await loadStyleProfile(teacherId);

  if (!profile.editPatterns.frequentlyDeletedSections.includes(sectionType)) {
    profile.editPatterns.frequentlyDeletedSections.push(sectionType);
  }
  profile.editPatterns.editCount++;

  // Keep only the top 10 most deleted sections
  if (profile.editPatterns.frequentlyDeletedSections.length > 10) {
    profile.editPatterns.frequentlyDeletedSections =
      profile.editPatterns.frequentlyDeletedSections.slice(-10);
  }

  await saveStyleProfile(teacherId, profile);
}

/**
 * Signal: Teacher added a section to AI-generated content.
 */
export async function onSectionAdded(
  teacherId: string,
  sectionType: string
): Promise<void> {
  const profile = await loadStyleProfile(teacherId);

  if (!profile.editPatterns.frequentlyAddedElements.includes(sectionType)) {
    profile.editPatterns.frequentlyAddedElements.push(sectionType);
  }
  profile.editPatterns.editCount++;

  if (profile.editPatterns.frequentlyAddedElements.length > 10) {
    profile.editPatterns.frequentlyAddedElements =
      profile.editPatterns.frequentlyAddedElements.slice(-10);
  }

  await saveStyleProfile(teacherId, profile);
}

// =========================================================================
// PROMPT INJECTION
// =========================================================================

/**
 * Build a prompt context block from a teacher's style profile.
 * Returns empty string if cold start (not enough data to be useful).
 */
export function buildTeacherStyleBlock(profile: TeacherStyleProfile): string {
  if (profile.confidenceLevel === "cold_start") {
    return "";
  }

  const lines: string[] = [];
  lines.push("## Teacher Style Profile");
  lines.push(
    `Confidence: ${profile.confidenceLevel} (${profile.lessonPatterns.uploadCount} uploads, ${profile.editPatterns.editCount} edits, ${profile.totalUnitsCreated} units created)`
  );

  // Lesson patterns
  if (profile.lessonPatterns.uploadCount >= 3) {
    lines.push(
      `Average lesson length: ${profile.lessonPatterns.averageLessonLength} min`
    );
    lines.push(
      `Theory:Practical ratio: ${Math.round(profile.lessonPatterns.averageTheoryPracticalRatio * 100)}:${Math.round((1 - profile.lessonPatterns.averageTheoryPracticalRatio) * 100)}`
    );

    if (profile.lessonPatterns.preferredActivityTypes.length > 0) {
      const top3 = profile.lessonPatterns.preferredActivityTypes.slice(0, 3);
      lines.push(
        `Most common activities: ${top3.map((a) => a.type).join(", ")}`
      );
    }
  }

  // Edit patterns
  if (profile.editPatterns.editCount >= 3) {
    if (profile.editPatterns.averageTimingAdjustment < -3) {
      lines.push(
        `This teacher consistently shortens AI-generated timing by ~${Math.abs(Math.round(profile.editPatterns.averageTimingAdjustment))} min. Generate shorter activities.`
      );
    } else if (profile.editPatterns.averageTimingAdjustment > 3) {
      lines.push(
        `This teacher consistently extends AI-generated timing by ~${Math.round(profile.editPatterns.averageTimingAdjustment)} min. Generate longer activities.`
      );
    }

    if (profile.editPatterns.frequentlyDeletedSections.length > 0) {
      lines.push(
        `Sections this teacher often removes: ${profile.editPatterns.frequentlyDeletedSections.join(", ")}. Consider omitting these.`
      );
    }

    if (profile.editPatterns.frequentlyAddedElements.length > 0) {
      lines.push(
        `Sections this teacher often adds: ${profile.editPatterns.frequentlyAddedElements.join(", ")}. Consider including these by default.`
      );
    }
  }

  if (lines.length <= 2) return ""; // Only header + confidence = not enough data

  return "\n\n" + lines.join("\n");
}
