// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withErrorHandler } from "@/lib/api/error-handler";
import type { UnitWizardInput } from "@/types";
import { onUnitCreated } from "@/lib/teacher-style/profile-service";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { OrchestratorConfig } from "@/lib/pipeline/orchestrator";
import { wizardInputToGenerationRequest } from "@/lib/pipeline/adapters/input-adapter";
import { MODELS } from "@/lib/ai/models";
import { timedUnitToContentData } from "@/lib/pipeline/adapters/output-adapter";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

/**
 * POST /api/teacher/generate-unit
 * Generate a full unit using the Dimensions3 pipeline.
 *
 * Body: { wizardInput: UnitWizardInput }
 * Returns: { pages, qualityReport, costSummary, runId }
 */
export const POST = withErrorHandler("teacher/generate-unit:POST", async (request: NextRequest) => {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { wizardInput } = body as { wizardInput: UnitWizardInput };

  if (!wizardInput) {
    return NextResponse.json({ error: "wizardInput is required" }, { status: 400 });
  }

  try {
    // Convert wizard input → pipeline request
    const generationRequest = wizardInputToGenerationRequest(wizardInput);

    // Configure the orchestrator
    const config: OrchestratorConfig = {
      supabase,
      teacherId: user.id,
      apiKey: process.env.ANTHROPIC_API_KEY!,
      sandboxMode: false,
      modelId: MODELS.SONNET,
    };

    // Run the Dimensions3 pipeline
    const result = await runPipeline(generationRequest, config);

    // Convert pipeline output → UnitContentDataV2 format
    const { contentData, pages } = timedUnitToContentData(
      result.timedUnit,
      result.qualityReport,
      wizardInput,
    );

    // Build pages record keyed by page ID for the wizard's MERGE_PAGES action
    const pagesRecord: Record<string, unknown> = {};
    for (const page of pages) {
      pagesRecord[page.id] = page.content;
    }

    // Signal teacher style profile: unit generated
    onUnitCreated(user.id).catch(() => {});

    return NextResponse.json({
      pages: pagesRecord,
      contentData,
      qualityReport: result.qualityReport,
      costSummary: result.totalCost,
      runId: result.runId,
      stageTimings: result.stageTimings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-unit] Pipeline error:", message);
    return NextResponse.json(
      { error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
});
