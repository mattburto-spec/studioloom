/**
 * Pipeline Orchestrator — Dimensions3 Phase C
 *
 * Runs the 6-stage generation pipeline sequentially.
 * Supports sandbox mode (uses simulator) and live mode (uses real AI).
 * Logs runs to generation_runs table.
 */

import type {
  CostBreakdown,
  GenerationRequest,
  BlockRetrievalResult,
  AssembledSequence,
  FilledSequence,
  PolishedSequence,
  TimedUnit,
  QualityReport,
} from "@/types/activity-blocks";
import { getFormatProfile, type FormatProfile } from "@/lib/ai/unit-types";
import {
  createGenerationRun,
  updateGenerationStage,
  completeGenerationRun,
  failGenerationRun,
} from "./generation-log";
import { loadAdminSettings, shouldEnforceCostCeilings, ADMIN_SETTINGS_DEFAULTS } from "@/lib/admin/settings";
import type { AdminSettings } from "@/lib/admin/settings";
import { AdminSettingKey } from "@/types/admin";

// Stage imports — live implementations
import { stage1_retrieveBlocks } from "./stages/stage1-retrieval";
import { stage2_assembleSequence } from "./stages/stage2-assembly";
import { stage3_fillGaps } from "./stages/stage3-generation";
import { stage4_polish } from "./stages/stage4-polish";
import { stage5_applyTiming } from "./stages/stage5-timing";
import { stage6_scoreQuality } from "./stages/stage6-scoring";

// Simulator imports — for sandbox mode
import {
  stage0_validateInput as sim_stage0,
  stage1_retrieveBlocks as sim_stage1,
  stage2_assembleSequence as sim_stage2,
  stage3_fillGaps as sim_stage3,
  stage4_polish as sim_stage4,
  stage5_applyTiming as sim_stage5,
  stage6_scoreQuality as sim_stage6,
} from "./pipeline";

// ─── Types ───

export interface OrchestratorConfig {
  supabase: { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };
  teacherId: string;
  apiKey: string;
  sandboxMode?: boolean;
  modelId?: string;
  maxConcurrency?: number;
}

export interface OrchestratorResult {
  timedUnit: TimedUnit;
  qualityReport: QualityReport;
  stageTimings: Record<string, number>;
  totalCost: CostBreakdown;
  runId: string | null;
}

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "none",
  estimatedCostUSD: 0, timeMs: 0,
};

function addCosts(a: CostBreakdown, b: CostBreakdown): CostBreakdown {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    modelId: b.modelId || a.modelId,
    estimatedCostUSD: a.estimatedCostUSD + b.estimatedCostUSD,
    timeMs: a.timeMs + b.timeMs,
  };
}

// ─── Main Orchestrator ───

export async function runPipeline(
  request: GenerationRequest,
  config: OrchestratorConfig
): Promise<OrchestratorResult> {
  const pipelineStart = Date.now();
  const timings: Record<string, number> = {};
  const stageCosts: Record<string, CostBreakdown> = {};
  let totalCost: CostBreakdown = { ...ZERO_COST };

  // Stage 0: Validate input + get FormatProfile
  let t0 = Date.now();
  const profile: FormatProfile = getFormatProfile(request.unitType);
  timings["stage0"] = Date.now() - t0;
  stageCosts["0"] = { ...ZERO_COST, timeMs: timings["stage0"] };

  // Load admin settings (feature-flag fallback: defaults if table unreachable)
  const adminSettings = await loadAdminSettings(config.supabase);
  const stageEnabled = adminSettings[AdminSettingKey.STAGE_ENABLED] as Record<string, boolean>;
  const costCeilingPerRun = adminSettings[AdminSettingKey.COST_CEILING_PER_RUN] as number;
  const costCeilingPerDay = adminSettings[AdminSettingKey.COST_CEILING_PER_DAY] as number;
  const modelOverride = adminSettings[AdminSettingKey.MODEL_OVERRIDE] as Record<string, string | null>;
  const starterPatternsEnabled = adminSettings[AdminSettingKey.STARTER_PATTERNS_ENABLED] as boolean;
  const enforceCostCeilings = shouldEnforceCostCeilings({ sandboxMode: config.sandboxMode });

  // Check daily cost ceiling before starting (non-sandbox only)
  if (enforceCostCeilings && costCeilingPerDay > 0) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: rollups } = await config.supabase
        .from("cost_rollups")
        .select("cost_usd")
        .eq("period", "day")
        .eq("period_start", today);
      const dailyTotal = (rollups ?? []).reduce((sum: number, r: { cost_usd: number }) => sum + r.cost_usd, 0);
      if (dailyTotal >= costCeilingPerDay) {
        throw new Error(`Daily cost ceiling exceeded: $${dailyTotal.toFixed(2)} >= $${costCeilingPerDay.toFixed(2)}`);
      }
    } catch (err) {
      // If it's our ceiling error, rethrow; otherwise log and continue (feature-flag fallback)
      if (err instanceof Error && err.message.startsWith("Daily cost ceiling exceeded")) throw err;
      console.warn("[orchestrator] Failed to check daily cost ceiling, continuing:", err instanceof Error ? err.message : err);
    }
  }

  // Create generation run log
  const runId = await createGenerationRun(
    config.supabase,
    config.teacherId,
    request,
    profile.type,
    request.framework,
    config.sandboxMode
  );

  try {
    if (config.sandboxMode) {
      return await runSimulatorPipeline(request, profile, runId, config, timings, stageCosts);
    }

    // Helper: resolve model ID for a stage (admin override > config > undefined)
    const resolveModel = (stageKey: string): string | undefined => {
      const override = modelOverride[stageKey];
      if (override) return override;
      return config.modelId;
    };

    // Helper: check per-run cost ceiling after each AI-calling stage
    const checkRunCeiling = () => {
      if (enforceCostCeilings && costCeilingPerRun > 0 && totalCost.estimatedCostUSD >= costCeilingPerRun) {
        throw new Error(
          `Per-run cost ceiling exceeded: $${totalCost.estimatedCostUSD.toFixed(2)} >= $${costCeilingPerRun.toFixed(2)}`
        );
      }
    };

    // ── Stage 1: Block Retrieval ──
    if (stageEnabled["retrieve"] === false) {
      throw new Error("Stage 1 (retrieve) is disabled by admin settings");
    }
    t0 = Date.now();
    const retrieval: BlockRetrievalResult = await stage1_retrieveBlocks(request, profile, {
      supabase: config.supabase,
      teacherId: config.teacherId,
      visibility: "private",
      starterPatternsEnabled: starterPatternsEnabled,
    });
    timings["stage1"] = Date.now() - t0;
    stageCosts["1"] = retrieval.retrievalMetrics.retrievalCost;
    totalCost = addCosts(totalCost, stageCosts["1"]);
    checkRunCeiling();

    if (runId) {
      await updateGenerationStage(config.supabase, runId, 1, {
        output: { candidatesReturned: retrieval.candidates.length },
        cost: stageCosts["1"],
        timeMs: timings["stage1"],
      });
    }

    // ── Stage 2: Sequence Assembly ──
    if (stageEnabled["assemble"] === false) {
      throw new Error("Stage 2 (assemble) is disabled by admin settings");
    }
    t0 = Date.now();
    const assembled: AssembledSequence = await stage2_assembleSequence(retrieval, profile, {
      apiKey: config.apiKey,
      modelId: resolveModel("assemble"),
    });
    timings["stage2"] = Date.now() - t0;
    stageCosts["2"] = assembled.sequenceMetrics.sequenceCost;
    totalCost = addCosts(totalCost, stageCosts["2"]);
    checkRunCeiling();

    if (runId) {
      await updateGenerationStage(config.supabase, runId, 2, {
        output: {
          totalSlots: assembled.sequenceMetrics.totalSlots,
          fillRate: assembled.sequenceMetrics.fillRate,
        },
        cost: stageCosts["2"],
        timeMs: timings["stage2"],
      });
    }

    // ── Stage 3: Gap Generation ──
    if (stageEnabled["gap_fill"] === false) {
      throw new Error("Stage 3 (gap_fill) is disabled by admin settings");
    }
    t0 = Date.now();
    const filled: FilledSequence = await stage3_fillGaps(assembled, profile, {
      apiKey: config.apiKey,
      modelId: resolveModel("gap_fill"),
      maxConcurrency: config.maxConcurrency ?? 4,
    });
    timings["stage3"] = Date.now() - t0;
    stageCosts["3"] = filled.generationMetrics.totalCost;
    totalCost = addCosts(totalCost, stageCosts["3"]);
    checkRunCeiling();

    if (runId) {
      await updateGenerationStage(config.supabase, runId, 3, {
        output: { gapsFilled: filled.generationMetrics.gapsFilled },
        cost: stageCosts["3"],
        timeMs: timings["stage3"],
      });
    }

    // ── Stage 4: Polish ──
    if (stageEnabled["polish"] === false) {
      throw new Error("Stage 4 (polish) is disabled by admin settings");
    }
    t0 = Date.now();
    const polished: PolishedSequence = await stage4_polish(filled, profile, {
      apiKey: config.apiKey,
      modelId: resolveModel("polish"),
    });
    timings["stage4"] = Date.now() - t0;
    stageCosts["4"] = polished.polishMetrics.totalCost;
    totalCost = addCosts(totalCost, stageCosts["4"]);
    checkRunCeiling();

    if (runId) {
      await updateGenerationStage(config.supabase, runId, 4, {
        output: { transitionsAdded: polished.polishMetrics.transitionsAdded },
        cost: stageCosts["4"],
        timeMs: timings["stage4"],
      });
    }

    // ── Stage 5: Timing ──
    if (stageEnabled["timing"] === false) {
      throw new Error("Stage 5 (timing) is disabled by admin settings");
    }
    t0 = Date.now();
    const timedUnit: TimedUnit = stage5_applyTiming(polished, profile);
    timings["stage5"] = Date.now() - t0;
    stageCosts["5"] = timedUnit.timingMetrics.timingCost;
    totalCost = addCosts(totalCost, stageCosts["5"]);

    if (runId) {
      await updateGenerationStage(config.supabase, runId, 5, {
        output: { overflowLessons: timedUnit.timingMetrics.overflowLessons.length },
        cost: stageCosts["5"],
        timeMs: timings["stage5"],
      });
    }

    // ── Stage 6: Quality Scoring ──
    if (stageEnabled["score"] === false) {
      throw new Error("Stage 6 (score) is disabled by admin settings");
    }
    t0 = Date.now();
    const qualityReport: QualityReport = stage6_scoreQuality(timedUnit, profile, stageCosts);
    timings["stage6"] = Date.now() - t0;
    stageCosts["6"] = { ...ZERO_COST, timeMs: timings["stage6"] };

    totalCost.timeMs = Date.now() - pipelineStart;

    if (runId) {
      await completeGenerationRun(config.supabase, runId, null, qualityReport, totalCost, totalCost.timeMs);
    }

    return { timedUnit, qualityReport, stageTimings: timings, totalCost, runId };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (runId) {
      await failGenerationRun(config.supabase, runId, errorMessage, -1);
    }
    throw e;
  }
}

// ─── Simulator Pipeline ───

async function runSimulatorPipeline(
  request: GenerationRequest,
  profile: FormatProfile,
  runId: string | null,
  config: OrchestratorConfig,
  timings: Record<string, number>,
  stageCosts: Record<string, CostBreakdown>
): Promise<OrchestratorResult> {
  const pipelineStart = Date.now();

  let t0 = Date.now();
  const retrieval = sim_stage1(request, profile);
  timings["stage1"] = Date.now() - t0;
  stageCosts["1"] = retrieval.retrievalMetrics.retrievalCost;

  t0 = Date.now();
  const assembled = sim_stage2(retrieval, profile);
  timings["stage2"] = Date.now() - t0;
  stageCosts["2"] = assembled.sequenceMetrics.sequenceCost;

  t0 = Date.now();
  const filled = sim_stage3(assembled, profile);
  timings["stage3"] = Date.now() - t0;
  stageCosts["3"] = filled.generationMetrics.totalCost;

  t0 = Date.now();
  const polished = sim_stage4(filled, profile);
  timings["stage4"] = Date.now() - t0;
  stageCosts["4"] = polished.polishMetrics.totalCost;

  t0 = Date.now();
  const timedUnit = sim_stage5(polished, profile);
  timings["stage5"] = Date.now() - t0;
  stageCosts["5"] = timedUnit.timingMetrics.timingCost;

  t0 = Date.now();
  const qualityReport = sim_stage6(timedUnit, profile);
  timings["stage6"] = Date.now() - t0;
  stageCosts["6"] = { ...ZERO_COST, timeMs: timings["stage6"] };

  const totalCost: CostBreakdown = {
    inputTokens: 0,
    outputTokens: 0,
    modelId: "simulator",
    estimatedCostUSD: 0,
    timeMs: Date.now() - pipelineStart,
  };

  if (runId) {
    await completeGenerationRun(config.supabase, runId, null, qualityReport, totalCost, totalCost.timeMs);
  }

  return { timedUnit, qualityReport, stageTimings: timings, totalCost, runId };
}
