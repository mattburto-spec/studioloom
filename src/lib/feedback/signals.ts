/**
 * Task D2 (part 1): Signal Aggregation Queries
 *
 * Queries generation_feedback, student_progress, and pace feedback
 * to gather signals for efficacy computation.
 */

import type { EfficacySignals } from "./types";

type SupabaseClient = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };

const TIME_WEIGHT_EXPECTED: Record<string, number> = {
  quick: 6,
  moderate: 14,
  extended: 25,
  flexible: 15,
};

/**
 * Gather teacher edit signals for a block from generation_feedback.
 */
export async function getTeacherSignals(
  supabase: SupabaseClient,
  blockId: string
): Promise<{ kept: number; deleted: number; edited: number; total: number }> {
  try {
    const { data, error } = await supabase
      .from("generation_feedback")
      .select("edit_type")
      .eq("source_block_id", blockId);

    if (error || !data) return { kept: 0, deleted: 0, edited: 0, total: 0 };

    const rows = data as Array<{ edit_type: string }>;
    const total = rows.length;
    const kept = rows.filter(r => r.edit_type === "kept").length;
    const deleted = rows.filter(r => r.edit_type === "deleted").length;
    const edited = rows.filter(r =>
      r.edit_type === "rewritten" || r.edit_type === "scaffolding_changed"
    ).length;

    return { kept, deleted, edited, total };
  } catch {
    return { kept: 0, deleted: 0, edited: 0, total: 0 };
  }
}

/**
 * Gather student completion and time signals from student_progress.
 * Looks for tracking keys matching the block's activity pattern.
 */
export async function getStudentSignals(
  supabase: SupabaseClient,
  blockId: string
): Promise<{ completions: number; starts: number; avgTimeSpent: number; timeObservations: number }> {
  try {
    // First, get the block's source unit + page for the join
    const { data: block } = await supabase
      .from("activity_blocks")
      .select("source_unit_id, source_page_id")
      .eq("id", blockId)
      .maybeSingle();

    if (!block?.source_unit_id) {
      return { completions: 0, starts: 0, avgTimeSpent: 0, timeObservations: 0 };
    }

    // Query student_progress rows for pages containing this block's activities
    // NOTE: Page-level granularity — one student_progress row per page, not per activity.
    // This is an acceptable approximation until per-activity tracking exists.
    let query = supabase
      .from("student_progress")
      .select("status, time_spent")
      .eq("unit_id", block.source_unit_id);

    if (block.source_page_id) {
      query = query.eq("page_id", block.source_page_id);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return { completions: 0, starts: 0, avgTimeSpent: 0, timeObservations: 0 };
    }

    const rows = data as Array<{ status: string; time_spent: number }>;
    const starts = rows.length;
    const completions = rows.filter(r => r.status === "complete").length;
    const timeRows = rows.filter(r => r.time_spent > 0);
    const avgTimeSpent = timeRows.length > 0
      ? timeRows.reduce((sum, r) => sum + r.time_spent, 0) / timeRows.length
      : 0;

    return {
      completions,
      starts,
      avgTimeSpent,
      timeObservations: timeRows.length,
    };
  } catch {
    return { completions: 0, starts: 0, avgTimeSpent: 0, timeObservations: 0 };
  }
}

/**
 * Gather pace feedback signals.
 * Maps pace feedback values: too_slow=0, just_right=0.5, too_fast=1 → inverted for score.
 */
export async function getPaceSignals(
  supabase: SupabaseClient,
  _blockId: string
): Promise<{ paceScore: number; feedbackCount: number }> {
  // Pace feedback is currently stored at lesson level (lesson_feedback table),
  // not per-block. Return neutral until per-block pace tracking is wired.
  return { paceScore: 0.5, feedbackCount: 0 };
}

/**
 * Aggregate all signals for a single block.
 */
export async function aggregateSignals(
  supabase: SupabaseClient,
  blockId: string,
  expectedTimeWeight: string = "moderate"
): Promise<EfficacySignals> {
  const [teacher, student, pace] = await Promise.all([
    getTeacherSignals(supabase, blockId),
    getStudentSignals(supabase, blockId),
    getPaceSignals(supabase, blockId),
  ]);

  const keptRate = teacher.total > 0 ? teacher.kept / teacher.total : 0.5;
  const deletionRate = teacher.total > 0 ? teacher.deleted / teacher.total : 0;
  const editRate = teacher.total > 0 ? teacher.edited / teacher.total : 0;
  const completionRate = student.starts > 0 ? student.completions / student.starts : 0.5;

  // Time accuracy: 1 - |actual - expected| / expected, clamped 0-1
  const expectedMinutes = TIME_WEIGHT_EXPECTED[expectedTimeWeight] ?? 14;
  const timeAccuracy = student.avgTimeSpent > 0
    ? Math.max(0, 1 - Math.abs(student.avgTimeSpent - expectedMinutes) / expectedMinutes)
    : 0.5;

  const evidenceCount =
    teacher.total + student.starts + student.timeObservations + pace.feedbackCount;

  return {
    blockId,
    keptRate,
    deletionRate,
    editRate,
    completionRate,
    timeAccuracy,
    paceScore: pace.paceScore,
    evidenceCount,
    signalBreakdown: {
      teacherInteractions: teacher.total,
      studentCompletions: student.starts,
      timeObservations: student.timeObservations,
      paceFeedbackCount: pace.feedbackCount,
    },
  };
}

/**
 * Get blocks that need efficacy recomputation.
 * Returns blocks with at least `minEvidence` data points.
 */
export async function getBlocksForRecomputation(
  supabase: SupabaseClient,
  teacherId: string,
  minEvidence: number = 3
): Promise<Array<{ id: string; title: string; efficacy_score: number; time_weight: string; times_used: number }>> {
  try {
    const { data, error } = await supabase
      .from("activity_blocks")
      .select("id, title, efficacy_score, time_weight, times_used")
      .eq("teacher_id", teacherId)
      .gte("times_used", minEvidence)
      .eq("is_archived", false)
      .order("times_used", { ascending: false })
      .limit(100);

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * Get block usage stats for self-healing analysis.
 */
export async function getBlockUsageStats(
  supabase: SupabaseClient,
  teacherId: string
): Promise<Array<{
  id: string;
  title: string;
  time_weight: string;
  bloom_level: string | null;
  avg_time_spent: number | null;
  avg_completion_rate: number | null;
  times_used: number;
  times_edited: number;
  times_skipped: number;
  efficacy_score: number;
}>> {
  try {
    const { data, error } = await supabase
      .from("activity_blocks")
      .select("id, title, time_weight, bloom_level, avg_time_spent, avg_completion_rate, times_used, times_edited, times_skipped, efficacy_score")
      .eq("teacher_id", teacherId)
      .gte("times_used", 5)
      .eq("is_archived", false)
      .order("times_used", { ascending: false })
      .limit(200);

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
