// audit-skip: ephemeral admin sandbox/test surface, no audit value
/**
 * POST /api/admin/generation-sandbox/run
 *
 * Runs the real Dimensions3 pipeline in sandbox mode.
 * Accepts a GenerationRequest directly (no wizard adapter needed).
 * Flags the generation_run as is_sandbox = true.
 *
 * Returns: { runId, pages, qualityReport, costSummary, stageTimings }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { OrchestratorConfig } from "@/lib/pipeline/orchestrator";
import type { GenerationRequest } from "@/types/activity-blocks";
import { MODELS } from "@/lib/ai/models";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { generationRequest, sandboxMode } = body as {
      generationRequest: GenerationRequest;
      sandboxMode?: boolean; // true = use fixture data (simulator), false = real AI
    };

    if (!generationRequest?.topic || !generationRequest?.unitType) {
      return NextResponse.json({ error: "generationRequest with topic and unitType required" }, { status: 400 });
    }

    const config: OrchestratorConfig = {
      supabase,
      teacherId: "00000000-0000-0000-0000-000000000000", // sandbox sentinel
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      sandboxMode: sandboxMode ?? true, // Default to simulator mode for safety
      modelId: MODELS.SONNET,
    };

    const result = await runPipeline(generationRequest, config);

    return NextResponse.json({
      runId: result.runId,
      stageTimings: result.stageTimings,
      qualityReport: result.qualityReport,
      costSummary: result.totalCost,
      timedUnit: result.timedUnit,
    });
  } catch (e) {
    console.error("[generation-sandbox/run] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pipeline failed" },
      { status: 500 }
    );
  }
}
