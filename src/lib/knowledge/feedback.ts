/**
 * Feedback loop for RAG quality improvement.
 * Tracks which chunks were used in generation and updates quality scores.
 * Also provides feedback aggregation for the learning loop (Layer 2).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  TeacherPostLessonFeedback,
  StudentPostLessonFeedback,
  AggregatedLessonFeedback,
  LessonFeedbackRow,
} from "@/types/lesson-intelligence";

/**
 * Record that a unit was generated using specific RAG chunks.
 * Called when teacher saves a generated unit.
 */
export async function recordGenerationUsage(
  chunkIds: string[]
): Promise<void> {
  if (chunkIds.length === 0) return;

  const supabaseAdmin = createAdminClient();

  // Mark chunks as used — boosts quality score
  for (const id of chunkIds) {
    try {
      await supabaseAdmin.rpc("increment_chunk_usage", { chunk_id: id });
    } catch {
      // Non-critical
    }
  }
}

/**
 * Update quality scores when a unit is forked.
 * All chunks from the forked unit get a quality boost.
 */
export async function recordFork(unitId: string): Promise<void> {
  const supabaseAdmin = createAdminClient();

  // Boost fork_count and quality_score for all chunks from this unit
  const { data: chunks } = await supabaseAdmin
    .from("knowledge_chunks")
    .select("id, quality_score, fork_count")
    .eq("source_type", "created_unit")
    .eq("source_id", unitId);

  if (!chunks?.length) return;

  for (const chunk of chunks) {
    await supabaseAdmin
      .from("knowledge_chunks")
      .update({
        fork_count: (chunk.fork_count || 0) + 1,
        quality_score: Math.min(1.0, (chunk.quality_score || 0.5) * 0.7 + 0.9 * 0.3),
        updated_at: new Date().toISOString(),
      })
      .eq("id", chunk.id);
  }
}

/**
 * Compute a simple edit distance score between generated and final content.
 * Returns 0-1 where 1 means no edits (AI nailed it) and 0 means complete rewrite.
 */
export function computeEditScore(
  originalText: string,
  editedText: string
): number {
  if (!originalText || !editedText) return 0;
  if (originalText === editedText) return 1;

  // Simple approach: compare word overlap (Jaccard similarity)
  const originalWords = new Set(originalText.toLowerCase().split(/\s+/));
  const editedWords = new Set(editedText.toLowerCase().split(/\s+/));

  let intersection = 0;
  for (const word of originalWords) {
    if (editedWords.has(word)) intersection++;
  }

  const union = originalWords.size + editedWords.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// =========================================================================
// FEEDBACK AGGREGATION (Layer 2)
// =========================================================================

/**
 * Aggregate all feedback for a lesson profile into a single intelligence object.
 * Computes averages, common patterns, timing variance, and best conditions.
 */
export async function aggregateFeedback(
  lessonProfileId: string
): Promise<AggregatedLessonFeedback | null> {
  const supabaseAdmin = createAdminClient();

  const { data: rows, error } = await supabaseAdmin
    .from("lesson_feedback")
    .select("*")
    .eq("lesson_profile_id", lessonProfileId)
    .order("created_at", { ascending: true });

  if (error || !rows || rows.length === 0) return null;

  // Separate teacher and student feedback
  const teacherRows = rows.filter(
    (r: LessonFeedbackRow) => r.feedback_type === "teacher"
  );
  const studentRows = rows.filter(
    (r: LessonFeedbackRow) => r.feedback_type === "student"
  );

  const teacherFeedback = teacherRows.map(
    (r: LessonFeedbackRow) => r.feedback_data as TeacherPostLessonFeedback
  );
  const studentFeedback = studentRows.map(
    (r: LessonFeedbackRow) => r.feedback_data as StudentPostLessonFeedback
  );

  // Teacher aggregates
  const avgTeacherRating = teacherFeedback.length > 0
    ? teacherFeedback.reduce((sum, f) => sum + f.overall_rating, 0) / teacherFeedback.length
    : 0;

  const avgDuration = teacherFeedback.length > 0
    ? teacherFeedback.reduce((sum, f) => sum + (f.actual_duration_minutes || 0), 0) / teacherFeedback.length
    : 0;

  // Count frequency of went_well and to_change items
  const wentWellCounts = countFrequency(teacherFeedback.flatMap((f) => f.went_well || []));
  const toChangeCounts = countFrequency(teacherFeedback.flatMap((f) => f.to_change || []));

  // Engagement distribution
  const engagementDist: Record<string, number> = {};
  for (const f of teacherFeedback) {
    engagementDist[f.student_engagement] = (engagementDist[f.student_engagement] || 0) + 1;
  }

  // Student aggregates
  const avgUnderstanding = studentFeedback.length > 0
    ? studentFeedback.reduce((sum, f) => sum + f.understanding, 0) / studentFeedback.length
    : 0;

  const avgEngagement = studentFeedback.length > 0
    ? studentFeedback.reduce((sum, f) => sum + f.engagement, 0) / studentFeedback.length
    : 0;

  const paceDist: Record<string, number> = {};
  for (const f of studentFeedback) {
    paceDist[f.pace] = (paceDist[f.pace] || 0) + 1;
  }

  const highlightCounts = countFrequency(
    studentFeedback.map((f) => f.highlight).filter(Boolean) as string[]
  );
  const struggleCounts = countFrequency(
    studentFeedback.map((f) => f.struggle).filter(Boolean) as string[]
  );

  // Timing reality — aggregate per-phase timing across all teacher feedback
  const timingMap = new Map<string, { planned: number; actuals: number[] }>();
  for (const f of teacherFeedback) {
    if (f.timing_notes) {
      for (const t of f.timing_notes) {
        const existing = timingMap.get(t.phase_title) || {
          planned: t.planned_minutes,
          actuals: [],
        };
        existing.actuals.push(t.actual_minutes);
        timingMap.set(t.phase_title, existing);
      }
    }
  }

  const timingReality = Array.from(timingMap.entries()).map(([title, data]) => ({
    phase_title: title,
    planned_minutes: data.planned,
    avg_actual_minutes: data.actuals.reduce((a, b) => a + b, 0) / data.actuals.length,
    variance: data.actuals.length > 1
      ? Math.sqrt(
          data.actuals.reduce((sum, v) => sum + Math.pow(v - data.actuals.reduce((a, b) => a + b, 0) / data.actuals.length, 2), 0) /
          data.actuals.length
        )
      : 0,
  }));

  // Best conditions
  const timeOfDayCounts = countFrequency(
    teacherFeedback.map((f) => f.time_of_day).filter(Boolean) as string[]
  );
  const bestTimeOfDay = timeOfDayCounts.length > 0 ? timeOfDayCounts[0] : undefined;

  return {
    lesson_profile_id: lessonProfileId,
    times_taught: teacherFeedback.length,
    avg_teacher_rating: avgTeacherRating,
    common_went_well: wentWellCounts.slice(0, 5),
    common_to_change: toChangeCounts.slice(0, 5),
    avg_actual_duration_minutes: avgDuration,
    engagement_distribution: engagementDist,
    avg_understanding: avgUnderstanding,
    avg_engagement: avgEngagement,
    pace_distribution: paceDist,
    common_highlights: highlightCounts.slice(0, 3),
    common_struggles: struggleCounts.slice(0, 3),
    timing_reality: timingReality,
    best_conditions: {
      time_of_day: bestTimeOfDay,
    },
    evolution_notes: `Feedback from ${teacherFeedback.length} teacher session(s) and ${studentFeedback.length} student response(s).`,
  };
}

/**
 * Count frequency of string items and return sorted (most common first).
 */
function countFrequency(items: string[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (normalized) {
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);
}

// =========================================================================
// FEEDBACK RETRIEVAL FOR RAG INJECTION (Layer 2)
// =========================================================================

/**
 * Retrieve aggregated feedback for a set of lesson profile IDs.
 * Called during RAG generation to inject teaching experience into prompts.
 *
 * This is the critical wire that closes the feedback loop:
 * teach → feedback → aggregate → inject into next generation
 */
export async function retrieveAggregatedFeedback(
  profileIds: string[]
): Promise<AggregatedLessonFeedback[]> {
  if (!profileIds || profileIds.length === 0) return [];

  const results: AggregatedLessonFeedback[] = [];

  for (const id of profileIds) {
    try {
      const aggregated = await aggregateFeedback(id);
      if (aggregated && aggregated.times_taught > 0) {
        results.push(aggregated);
      }
    } catch {
      // Non-critical — feedback is enhancement
    }
  }

  return results;
}

// =========================================================================
// FEEDBACK QUALITY RE-SCORING (Layer 2)
// =========================================================================

/**
 * Update chunk quality scores based on teacher/student feedback.
 *
 * - Teacher rating 4-5 + would_use_again → boost (+0.1)
 * - Teacher rating 1-2 → penalize (-0.1, floor 0.1)
 * - Student avg understanding ≥ 4.0 + pace "just_right" → boost (+0.05)
 *
 * Called fire-and-forget after feedback is stored.
 */
export async function updateQualityFromFeedback(
  unitId: string,
  feedbackType: "teacher" | "student",
  feedbackData: TeacherPostLessonFeedback | StudentPostLessonFeedback
): Promise<void> {
  if (!unitId) return;

  const supabaseAdmin = createAdminClient();

  // Find chunks associated with this unit
  const { data: chunks } = await supabaseAdmin
    .from("knowledge_chunks")
    .select("id, quality_score")
    .eq("source_id", unitId);

  if (!chunks?.length) return;

  // Feedback deltas — configurable via admin panel (model-config-defaults.ts)
  // Import defaults inline to avoid circular dependency; admin override loaded at call site
  const { DEFAULT_FEEDBACK_WEIGHTS } = await import("@/lib/ai/model-config-defaults");
  const fw = DEFAULT_FEEDBACK_WEIGHTS;

  let delta = 0;

  if (feedbackType === "teacher") {
    const tf = feedbackData as TeacherPostLessonFeedback;
    if (tf.overall_rating >= 4 && tf.would_use_again) {
      delta = fw.teacherStrongPositive;
    } else if (tf.overall_rating >= 4) {
      delta = fw.teacherPositive;
    } else if (tf.overall_rating <= 2) {
      delta = fw.teacherNegative;
    }
  } else {
    const sf = feedbackData as StudentPostLessonFeedback;
    if (sf.understanding >= 4 && sf.pace === "just_right") {
      delta = fw.studentPositive;
    } else if (sf.understanding <= 2) {
      delta = fw.studentNegative;
    }
  }

  if (delta === 0) return;

  for (const chunk of chunks) {
    const currentScore = chunk.quality_score || 0.5;
    const newScore = Math.max(0.1, Math.min(1.0, currentScore + delta));

    try {
      await supabaseAdmin
        .from("knowledge_chunks")
        .update({
          quality_score: newScore,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chunk.id);
    } catch {
      // Non-critical
    }
  }
}
