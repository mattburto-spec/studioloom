/**
 * Generation run logging — records pipeline executions to generation_runs table.
 * Fire-and-forget by design: logging failures never block generation.
 */

import type { CostBreakdown, GenerationRequest, QualityReport } from "@/types/activity-blocks";

export interface GenerationRun {
  id: string;
  teacher_id: string;
  request: GenerationRequest;
  format_id: string;
  framework: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  current_stage: number;
  stage_results: Record<string, { output: unknown; cost: CostBreakdown; timeMs: number }>;
  output_unit_id: string | null;
  quality_report: QualityReport | null;
  total_cost: CostBreakdown | null;
  total_time_ms: number | null;
  error_message: string | null;
  error_stage: number | null;
  sandbox_mode: boolean;
  created_at: string;
  updated_at: string;
}

/** Create a new generation run record. Returns the run ID. */
export async function createGenerationRun(
  supabase: { from: (table: string) => any },
  teacherId: string,
  request: GenerationRequest,
  formatId: string,
  framework: string,
  sandboxMode: boolean = false
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("generation_runs")
      .insert({
        teacher_id: teacherId,
        request,
        format_id: formatId,
        framework,
        status: "pending",
        current_stage: 0,
        sandbox_mode: sandboxMode,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[generation-log] Failed to create run:", error.message);
      return null;
    }
    return data.id;
  } catch (e) {
    console.error("[generation-log] Exception creating run:", e);
    return null;
  }
}

/** Update a generation run with stage progress. */
export async function updateGenerationStage(
  supabase: { from: (table: string) => any },
  runId: string,
  stage: number,
  stageResult: { output: unknown; cost: CostBreakdown; timeMs: number }
): Promise<void> {
  try {
    // Read current stage_results, merge new stage
    const { data } = await supabase
      .from("generation_runs")
      .select("stage_results")
      .eq("id", runId)
      .single();

    const existing = data?.stage_results ?? {};
    existing[String(stage)] = stageResult;

    await supabase
      .from("generation_runs")
      .update({
        current_stage: stage,
        status: "running",
        stage_results: existing,
      })
      .eq("id", runId);
  } catch (e) {
    console.error(`[generation-log] Failed to update stage ${stage}:`, e);
  }
}

/** Mark a generation run as completed. */
export async function completeGenerationRun(
  supabase: { from: (table: string) => any },
  runId: string,
  outputUnitId: string | null,
  qualityReport: QualityReport | null,
  totalCost: CostBreakdown,
  totalTimeMs: number
): Promise<void> {
  try {
    await supabase
      .from("generation_runs")
      .update({
        status: "completed",
        output_unit_id: outputUnitId,
        quality_report: qualityReport,
        total_cost: totalCost,
        total_time_ms: totalTimeMs,
      })
      .eq("id", runId);
  } catch (e) {
    console.error("[generation-log] Failed to complete run:", e);
  }
}

/** Mark a generation run as failed. */
export async function failGenerationRun(
  supabase: { from: (table: string) => any },
  runId: string,
  errorMessage: string,
  errorStage: number
): Promise<void> {
  try {
    await supabase
      .from("generation_runs")
      .update({
        status: "failed",
        error_message: errorMessage,
        error_stage: errorStage,
      })
      .eq("id", runId);
  } catch (e) {
    console.error("[generation-log] Failed to record failure:", e);
  }
}
