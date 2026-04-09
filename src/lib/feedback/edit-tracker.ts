/**
 * Task D1: Teacher Edit Tracker (Diff Detection)
 *
 * When a teacher saves a unit that was generated via the pipeline,
 * detects what they changed per-activity and stores diffs in
 * the generation_feedback table.
 */

import type { ActivityDiff, EditTrackingResult, EditType } from "./types";

// ─── Diff Computation ───

interface ActivitySnapshot {
  id: string;
  title: string;
  prompt: string;
  description?: string;
  scaffolding?: unknown;
  example_response?: string;
  bloom_level?: string;
  time_weight?: string;
  grouping?: string;
  phase?: string;
  activity_category?: string;
  lesson_structure_role?: string;
  source_block_id?: string | null;
  [key: string]: unknown;
}

/**
 * Extract a flat list of activities from content_data (handles v2 pages format).
 * Each activity gets a positional index for reorder detection.
 */
export function extractActivities(contentData: Record<string, unknown>): ActivitySnapshot[] {
  const activities: ActivitySnapshot[] = [];
  const pages = (contentData?.pages ?? []) as Array<Record<string, unknown>>;

  let globalIndex = 0;
  for (const page of pages) {
    const sections = (page?.sections ?? page?.activities ?? []) as Array<Record<string, unknown>>;
    for (const section of sections) {
      const id = (section.activityId ?? section.id ?? `pos_${globalIndex}`) as string;
      activities.push({
        id,
        title: (section.title ?? section.label ?? "") as string,
        prompt: (section.prompt ?? section.description ?? section.content ?? "") as string,
        description: (section.description ?? "") as string,
        scaffolding: section.scaffolding,
        example_response: (section.example_response ?? section.exampleResponse ?? "") as string,
        bloom_level: (section.bloom_level ?? section.bloomLevel ?? "") as string,
        time_weight: (section.time_weight ?? section.timeWeight ?? "") as string,
        grouping: (section.grouping ?? "") as string,
        phase: (section.phase ?? "") as string,
        activity_category: (section.activity_category ?? section.activityCategory ?? "") as string,
        lesson_structure_role: (section.lesson_structure_role ?? section.lessonStructureRole ?? "") as string,
        source_block_id: (section.source_block_id ?? section.sourceBlockId ?? null) as string | null,
        _position: globalIndex,
      });
      globalIndex++;
    }
  }
  return activities;
}

/**
 * Compute text similarity between two strings using simple Levenshtein-based diff percentage.
 * Returns a number 0-100 representing the percentage of text that changed.
 */
export function computeDiffPercentage(before: string, after: string): number {
  if (!before && !after) return 0;
  if (!before || !after) return 100;

  const a = before.trim().toLowerCase();
  const b = after.trim().toLowerCase();
  if (a === b) return 0;

  // Use word-level diff for efficiency
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  const maxLen = Math.max(wordsA.length, wordsB.length);
  if (maxLen === 0) return 0;

  // Count matching words (order-sensitive, greedy LCS approximation)
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const commonWords = [...setA].filter(w => setB.has(w)).length;
  const maxSetLen = Math.max(setA.size, setB.size);

  if (maxSetLen === 0) return 0;
  const similarity = commonWords / maxSetLen;
  return Math.round((1 - similarity) * 100);
}

/**
 * Classify an edit based on before/after activity snapshots.
 */
export function classifyEdit(
  before: ActivitySnapshot,
  after: ActivitySnapshot,
  beforePosition: number,
  afterPosition: number
): { editType: EditType; diffPercentage: number } {
  // Compare primary text fields
  const textBefore = `${before.title} ${before.prompt} ${before.description ?? ""}`;
  const textAfter = `${after.title} ${after.prompt} ${after.description ?? ""}`;
  const textDiff = computeDiffPercentage(textBefore, textAfter);

  // Check if only scaffolding changed
  const scaffoldingBefore = JSON.stringify(before.scaffolding ?? {});
  const scaffoldingAfter = JSON.stringify(after.scaffolding ?? {});
  const scaffoldingChanged = scaffoldingBefore !== scaffoldingAfter;
  const exampleBefore = before.example_response ?? "";
  const exampleAfter = after.example_response ?? "";
  const exampleChanged = exampleBefore !== exampleAfter;

  // Reorder detection
  if (beforePosition !== afterPosition && textDiff < 20) {
    return { editType: "reordered", diffPercentage: textDiff };
  }

  // Trivial or no changes
  if (textDiff < 5 && !scaffoldingChanged && !exampleChanged) {
    return { editType: "kept", diffPercentage: textDiff };
  }

  // Only scaffolding/example changed
  if (textDiff < 20 && (scaffoldingChanged || exampleChanged)) {
    return { editType: "scaffolding_changed", diffPercentage: textDiff };
  }

  // Substantial rewrite
  if (textDiff >= 20) {
    return { editType: "rewritten", diffPercentage: textDiff };
  }

  return { editType: "kept", diffPercentage: textDiff };
}

/**
 * Compare original generated content against teacher-saved content.
 * Returns per-activity diffs.
 */
export function computeEditDiffs(
  originalContent: Record<string, unknown>,
  savedContent: Record<string, unknown>
): ActivityDiff[] {
  const originalActivities = extractActivities(originalContent);
  const savedActivities = extractActivities(savedContent);

  const diffs: ActivityDiff[] = [];

  // Build lookup by ID for the saved version
  const savedById = new Map<string, { activity: ActivitySnapshot; index: number }>();
  savedActivities.forEach((a, i) => savedById.set(a.id, { activity: a, index: i }));

  const matchedSavedIds = new Set<string>();

  // Check each original activity
  for (let i = 0; i < originalActivities.length; i++) {
    const original = originalActivities[i];
    const saved = savedById.get(original.id);

    if (!saved) {
      // Activity was deleted
      diffs.push({
        activityId: original.id,
        activityTitle: original.title,
        editType: "deleted",
        diffPercentage: 100,
        sourceBlockId: original.source_block_id ?? null,
        beforeSnapshot: original as unknown as Record<string, unknown>,
        afterSnapshot: null,
        position: { before: i, after: null },
      });
    } else {
      matchedSavedIds.add(original.id);
      const { editType, diffPercentage } = classifyEdit(original, saved.activity, i, saved.index);
      diffs.push({
        activityId: original.id,
        activityTitle: original.title,
        editType,
        diffPercentage,
        sourceBlockId: original.source_block_id ?? null,
        beforeSnapshot: original as unknown as Record<string, unknown>,
        afterSnapshot: saved.activity as unknown as Record<string, unknown>,
        position: { before: i, after: saved.index },
      });
    }
  }

  // Activities in saved but not in original = teacher added
  for (let j = 0; j < savedActivities.length; j++) {
    const saved = savedActivities[j];
    if (!matchedSavedIds.has(saved.id)) {
      diffs.push({
        activityId: saved.id,
        activityTitle: saved.title,
        editType: "added",
        diffPercentage: 100,
        sourceBlockId: null,
        beforeSnapshot: null,
        afterSnapshot: saved as unknown as Record<string, unknown>,
        position: { before: -1, after: j },
      });
    }
  }

  return diffs;
}

/**
 * Build a summary of diffs for quick review.
 */
export function summarizeDiffs(diffs: ActivityDiff[]): EditTrackingResult["summary"] {
  const summary = {
    kept: 0,
    rewritten: 0,
    scaffoldingChanged: 0,
    reordered: 0,
    deleted: 0,
    added: 0,
    totalOriginal: 0,
    totalAfter: 0,
  };

  for (const d of diffs) {
    switch (d.editType) {
      case "kept": summary.kept++; break;
      case "rewritten": summary.rewritten++; break;
      case "scaffolding_changed": summary.scaffoldingChanged++; break;
      case "reordered": summary.reordered++; break;
      case "deleted": summary.deleted++; break;
      case "added": summary.added++; break;
    }
  }

  summary.totalOriginal = diffs.filter(d => d.editType !== "added").length;
  summary.totalAfter = diffs.filter(d => d.editType !== "deleted").length;
  return summary;
}

/**
 * Full edit tracking: compute diffs and store in generation_feedback table.
 * Called after unit save when the unit has a generation_run_id.
 */
export async function trackEdits(
  supabase: { from: (table: string) => any },
  generationRunId: string,
  unitId: string,
  originalContent: Record<string, unknown>,
  savedContent: Record<string, unknown>
): Promise<EditTrackingResult> {
  const diffs = computeEditDiffs(originalContent, savedContent);
  const summary = summarizeDiffs(diffs);
  const now = new Date().toISOString();

  // Store each diff as a generation_feedback row
  const rows = diffs.map(d => ({
    generation_run_id: generationRunId,
    unit_id: unitId,
    activity_id: d.activityId,
    source_block_id: d.sourceBlockId,
    edit_type: d.editType,
    diff_percentage: d.diffPercentage,
    before_snapshot: d.beforeSnapshot,
    after_snapshot: d.afterSnapshot,
    position_before: d.position.before,
    position_after: d.position.after,
    created_at: now,
  }));

  if (rows.length > 0) {
    try {
      await supabase.from("generation_feedback").insert(rows);
    } catch (e) {
      console.error("[edit-tracker] Failed to store diffs:", e);
    }
  }

  return { generationRunId, unitId, diffs, summary, computedAt: now };
}
