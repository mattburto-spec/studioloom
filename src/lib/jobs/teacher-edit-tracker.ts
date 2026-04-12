import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Job 4: Teacher Edit Tracker
 * Aggregate generation_feedback table by edit_type and identify most-edited/deleted blocks.
 */
export async function run(
  supabase: SupabaseClient
): Promise<{ alertId: string; summary: Record<string, unknown> }> {
  const { data: feedbacks, error } = await supabase
    .from("generation_feedback")
    .select("edit_type, source_block_id");

  if (error) {
    throw new Error(`Failed to fetch generation feedback: ${error.message}`);
  }

  const feedback = feedbacks ?? [];

  // Aggregate by edit_type
  const editsByType: Record<string, number> = {};
  for (const fb of feedback) {
    const editType = (fb.edit_type as string) || "unknown";
    editsByType[editType] = (editsByType[editType] ?? 0) + 1;
  }

  // Find most-edited blocks
  const blockEditCounts = new Map<string, number>();
  const blockDeleteCounts = new Map<string, number>();

  for (const fb of feedback) {
    const blockId = (fb.source_block_id as string) || "unknown";
    const editType = (fb.edit_type as string) || "unknown";

    blockEditCounts.set(blockId, (blockEditCounts.get(blockId) ?? 0) + 1);

    if (editType === "deleted") {
      blockDeleteCounts.set(blockId, (blockDeleteCounts.get(blockId) ?? 0) + 1);
    }
  }

  // Sort and take top 5
  const mostEdited = Array.from(blockEditCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([block_id, count]) => ({ block_id, count }));

  const mostDeleted = Array.from(blockDeleteCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([block_id, count]) => ({ block_id, count }));

  const { data: alertData, error: insertError } = await supabase
    .from("system_alerts")
    .insert({
      alert_type: "teacher_edits",
      severity: "info",
      payload: {
        period: "daily",
        editsByType,
        mostEdited,
        mostDeleted,
      },
    })
    .select("id");

  if (insertError) {
    throw new Error(`Failed to insert alert: ${insertError.message}`);
  }

  const alertId = (alertData?.[0]?.id as string) ?? "";

  return {
    alertId,
    summary: {
      totalEdits: feedback.length,
      editsByType,
      mostEditedBlocks: mostEdited.length,
      mostDeletedBlocks: mostDeleted.length,
    },
  };
}
