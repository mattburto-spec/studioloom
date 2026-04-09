/**
 * E5: Teacher Edit Tracker Summary
 * Most-edited and most-deleted blocks from generation_feedback.
 */

type SupabaseClient = { from: (table: string) => any };

export interface EditTrackerSummaryResult {
  status: "green" | "amber" | "red";
  totalEdits: number;
  mostEdited: Array<{ blockId: string; editCount: number; editType: string }>;
  mostDeleted: Array<{ blockId: string; deleteCount: number }>;
  alerts: string[];
}

export async function checkEditTrackerSummary(supabase: SupabaseClient): Promise<EditTrackerSummaryResult> {
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let feedback: any[] = [];
  try {
    const { data } = await supabase
      .from("generation_feedback")
      .select("source_block_id, edit_type")
      .gte("created_at", d30);
    feedback = data || [];
  } catch { /* empty */ }

  const editCounts = new Map<string, number>();
  const deleteCounts = new Map<string, number>();

  for (const f of feedback) {
    const blockId = f.source_block_id || "unknown";
    if (f.edit_type === "deleted") {
      deleteCounts.set(blockId, (deleteCounts.get(blockId) || 0) + 1);
    }
    if (f.edit_type === "rewritten" || f.edit_type === "scaffolding_changed") {
      editCounts.set(blockId, (editCounts.get(blockId) || 0) + 1);
    }
  }

  const mostEdited = [...editCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([blockId, editCount]) => ({ blockId, editCount, editType: "rewritten" }));

  const mostDeleted = [...deleteCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([blockId, deleteCount]) => ({ blockId, deleteCount }));

  const alerts: string[] = [];
  if (mostDeleted.length > 0 && mostDeleted[0].deleteCount >= 5) {
    alerts.push(`Block ${mostDeleted[0].blockId.slice(0, 8)}... deleted ${mostDeleted[0].deleteCount} times`);
  }

  const status: EditTrackerSummaryResult["status"] =
    alerts.length > 0 ? "amber" : "green";

  return { status, totalEdits: feedback.length, mostEdited, mostDeleted, alerts };
}
