/**
 * Ingestion Pipeline Orchestrator
 *
 * Full pipeline: Dedup → Parse → Pass A → Pass B → Extract
 * Split pipeline: Classify (Parse + Pass A) → Checkpoint → Continue (Pass B + Extract)
 *
 * Each stage chains typed output to the next input.
 * All stages return CostBreakdown for transparency.
 */

import type { CostBreakdown } from "@/types/activity-blocks";
import type {
  PassConfig,
  DedupResult,
  ParseResult,
  IngestionClassification,
  IngestionAnalysis,
  ExtractionResult,
  ModerationStageResult,
  IngestionPipelineResult,
  CopyrightFlag,
} from "./types";
import { dedupCheck } from "./dedup";
import { parseDocument } from "./parse";
import { ingestionPasses } from "./registry";
import { extractBlocks } from "./extract";
import { checkBlocksForCopyright } from "./copyright-check";
import { moderateExtractedBlocks } from "./moderate";
import { moderateContent } from "@/lib/content-safety/server-moderation";
import type { ModerationContext } from "@/lib/content-safety/types";
import { fetchTeacherCorrections, buildPassACorrections, buildPassBCorrections } from "./corrections";
import type { IngestionCorrection } from "./corrections";

/**
 * Sum a list of CostBreakdown objects into a single aggregate. Exported
 * for unit tests so the cost-tracking regression guard can verify all
 * stage costs roll up correctly. Phase 1.5 item 9.
 */
export function sumCosts(...costs: CostBreakdown[]): CostBreakdown {
  return {
    inputTokens: costs.reduce((s, c) => s + c.inputTokens, 0),
    outputTokens: costs.reduce((s, c) => s + c.outputTokens, 0),
    modelId: "pipeline",
    estimatedCostUSD: costs.reduce((s, c) => s + c.estimatedCostUSD, 0),
    timeMs: costs.reduce((s, c) => s + c.timeMs, 0),
  };
}

export interface IngestionInput {
  /** Raw text content of the uploaded document */
  rawText: string;
  /** Copyright marking from upload form */
  copyrightFlag?: CopyrightFlag;
}

/**
 * Run the full ingestion pipeline synchronously (in Next.js API route).
 *
 * Stateless pass functions (OS Seam 1) — Supabase client passed via config.
 * Same functions can be wrapped in OS job queue workers later.
 */
export async function runIngestionPipeline(
  input: IngestionInput,
  config: PassConfig
): Promise<IngestionPipelineResult> {
  const startTime = Date.now();

  // Stage I-0: Dedup (skippable for import route where re-processing is expected)
  const dedup: DedupResult = config.skipDedup
    ? { isDuplicate: false, fileHash: "", cost: { inputTokens: 0, outputTokens: 0, modelId: "none", estimatedCostUSD: 0, timeMs: 0 } }
    : await dedupCheck(input.rawText, config);

  if (dedup.isDuplicate) {
    const zeroCost: CostBreakdown = {
      inputTokens: 0, outputTokens: 0, modelId: "none",
      estimatedCostUSD: 0, timeMs: Date.now() - startTime,
    };
    return {
      contentItemId: dedup.existingContentItemId,
      dedup,
      parse: { title: "", sections: [], totalWordCount: 0, headingCount: 0, cost: zeroCost },
      classification: {
        documentType: "unknown",
        confidence: 0,
        confidences: { documentType: 0 },
        topic: "",
        sections: [],
        cost: zeroCost,
      },
      analysis: {
        classification: {
          documentType: "unknown",
          confidence: 0,
          confidences: { documentType: 0 },
          topic: "",
          sections: [],
          cost: zeroCost,
        },
        enrichedSections: [],
        cost: zeroCost,
      },
      extraction: {
        blocks: [], totalSectionsProcessed: 0, activitySectionsFound: 0,
        piiDetected: false, cost: zeroCost,
      },
      moderation: {
        blocks: [],
        cost: zeroCost,
        approvedCount: 0,
        flaggedCount: 0,
        pendingCount: 0,
      },
      totalCost: zeroCost,
      totalTimeMs: Date.now() - startTime,
    };
  }

  // Stage I-1: Deterministic Parse
  const parse: ParseResult = parseDocument(input.rawText);

  // Phase 6C: Upload-level safety pre-check
  // Scans full extracted text BEFORE AI analysis. If flagged/blocked, sets
  // processing_status = 'moderation_hold' and returns early.
  // API failure (status='pending') → proceed normally (teacher uploads get benefit of doubt).
  if (!config.sandboxMode && config.apiKey) {
    const textSample = input.rawText.slice(0, 5000);
    const safetyContext: ModerationContext = {
      classId: config.teacherId || "system",
      studentId: config.teacherId || "system",
      source: "upload_image", // closest valid source for teacher uploads
    };
    try {
      const safetyResult = await moderateContent(textSample, safetyContext, config.apiKey);
      if (safetyResult.moderation.status === "blocked" || safetyResult.moderation.status === "flagged") {
        // Return early with moderationHold flag — the API route sets
        // processing_status='moderation_hold' on the content_items insert.
        const zeroCost: CostBreakdown = {
          inputTokens: 0, outputTokens: 0, modelId: "none",
          estimatedCostUSD: 0, timeMs: Date.now() - startTime,
        };
        return {
          dedup,
          parse,
          classification: {
            documentType: "unknown", confidence: 0,
            confidences: { documentType: 0 }, topic: "", sections: [], cost: zeroCost,
          },
          analysis: {
            classification: {
              documentType: "unknown", confidence: 0,
              confidences: { documentType: 0 }, topic: "", sections: [], cost: zeroCost,
            },
            enrichedSections: [], cost: zeroCost,
          },
          extraction: {
            blocks: [], totalSectionsProcessed: 0, activitySectionsFound: 0,
            piiDetected: false, cost: zeroCost,
          },
          moderation: {
            blocks: [], cost: zeroCost,
            approvedCount: 0, flaggedCount: 0, pendingCount: 0,
          },
          totalCost: sumCosts(dedup.cost, parse.cost, safetyResult.cost),
          totalTimeMs: Date.now() - startTime,
          moderationHold: true,
          moderationHoldReason: `Upload held: content ${safetyResult.moderation.status} (${safetyResult.moderation.flags.map(f => f.type).join(", ")})`,
        } as IngestionPipelineResult;
      }
    } catch (err) {
      // Safety scan failure → proceed (teacher uploads get benefit of doubt)
      console.error("[pipeline] Safety pre-check failed, proceeding:", err instanceof Error ? err.message : err);
    }
  }

  // Stages I-2..I-N: Run all registered AI passes in order.
  // Each pass chains its output to the next pass's input.
  // Adding a future Pass C = write function + push to registry. No pipeline edits.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passOutputs: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let passInput: any = parse;

  for (const pass of ingestionPasses) {
    const output = await pass.run(passInput, config);
    passOutputs[pass.id] = output;
    passInput = output; // chain to next pass
  }

  const classification = passOutputs["pass-a-classify"] as IngestionClassification;
  const analysis = passOutputs["pass-b-analyse"] as IngestionAnalysis;

  // Stage I-4: Block Extraction + PII + Copyright (user-declared)
  const extractionRaw: ExtractionResult = extractBlocks(
    analysis,
    input.copyrightFlag || "unknown"
  );

  // Stage I-4b: Copyright heuristic — flip any block whose prompt/description
  // contains a ≥200 char verbatim match against the existing block corpus.
  // Failure-safe: DB errors leave blocks unchanged.
  const copyrightCheck = await checkBlocksForCopyright(extractionRaw.blocks, config);
  const extraction: ExtractionResult = {
    ...extractionRaw,
    blocks: copyrightCheck.blocks,
    cost: {
      ...extractionRaw.cost,
      timeMs: extractionRaw.cost.timeMs + copyrightCheck.cost.timeMs,
    },
  };

  // Stage I-5: Haiku moderation on extracted blocks (§17.6 Phase B).
  // Runs after extract so the moderator sees the final title/prompt/description
  // each block will carry into the review queue. Failure-safe — any Haiku error
  // leaves every block at 'pending' rather than auto-approving.
  const moderationRaw = await moderateExtractedBlocks(extraction.blocks, config);
  const moderation: ModerationStageResult = {
    blocks: moderationRaw.blocks,
    cost: moderationRaw.cost,
    approvedCount: moderationRaw.blocks.filter((b) => b.moderationStatus === "approved").length,
    flaggedCount: moderationRaw.blocks.filter((b) => b.moderationStatus === "flagged").length,
    pendingCount: moderationRaw.blocks.filter((b) => b.moderationStatus === "pending").length,
  };

  const totalCost = sumCosts(
    dedup.cost,
    parse.cost,
    classification.cost,
    analysis.cost,
    extraction.cost,
    moderation.cost
  );

  return {
    dedup,
    parse,
    classification,
    analysis,
    extraction,
    moderation,
    totalCost: { ...totalCost, timeMs: Date.now() - startTime },
    totalTimeMs: Date.now() - startTime,
  };
}

// =========================================================================
// Split Pipeline — Classify Stage (for interactive checkpoint)
// =========================================================================

export interface ClassifyStageResult {
  parse: ParseResult;
  classification: IngestionClassification;
  /** Corrections from this teacher injected into the prompt */
  correctionsUsed: number;
  cost: CostBreakdown;
  timeMs: number;
  /** Set when upload-level safety scan flagged the content */
  moderationHold?: boolean;
  moderationHoldReason?: string;
}

/**
 * Run Parse + Safety pre-check + Pass A only.
 * Returns classification for user review at the interactive checkpoint.
 * Pass B + Extract + Moderate run separately via runContinueStage().
 */
export async function runClassifyStage(
  input: IngestionInput,
  config: PassConfig
): Promise<ClassifyStageResult> {
  const startTime = Date.now();

  // Stage I-1: Deterministic Parse
  const parse: ParseResult = parseDocument(input.rawText);

  // Phase 6C: Upload-level safety pre-check
  if (!config.sandboxMode && config.apiKey) {
    const textSample = input.rawText.slice(0, 5000);
    const safetyContext: ModerationContext = {
      classId: config.teacherId || "system",
      studentId: config.teacherId || "system",
      source: "upload_image",
    };
    try {
      const safetyResult = await moderateContent(textSample, safetyContext, config.apiKey);
      if (safetyResult.moderation.status === "blocked" || safetyResult.moderation.status === "flagged") {
        const zeroCost: CostBreakdown = {
          inputTokens: 0, outputTokens: 0, modelId: "none",
          estimatedCostUSD: 0, timeMs: Date.now() - startTime,
        };
        return {
          parse,
          classification: {
            documentType: "unknown", confidence: 0,
            confidences: { documentType: 0 }, topic: "", sections: [], cost: zeroCost,
          },
          correctionsUsed: 0,
          cost: sumCosts(parse.cost, safetyResult.cost),
          timeMs: Date.now() - startTime,
          moderationHold: true,
          moderationHoldReason: `Upload held: content ${safetyResult.moderation.status} (${safetyResult.moderation.flags.map(f => f.type).join(", ")})`,
        };
      }
    } catch (err) {
      console.error("[pipeline/classify] Safety pre-check failed, proceeding:", err instanceof Error ? err.message : err);
    }
  }

  // Fetch teacher corrections for few-shot injection
  let corrections: IngestionCorrection[] = [];
  try {
    corrections = await fetchTeacherCorrections(config);
  } catch {
    // Advisory — never block
  }

  // Stage I-2: Pass A — Classify + Tag
  const passA = ingestionPasses[0]; // pass-a-classify
  const correctionContext = buildPassACorrections(corrections);

  // Inject corrections into config as a temporary override
  const passAConfig = correctionContext
    ? { ...config, _correctionContext: correctionContext }
    : config;

  const classification = await passA.run(parse, passAConfig) as IngestionClassification & { cost: CostBreakdown };

  return {
    parse,
    classification,
    correctionsUsed: corrections.length,
    cost: sumCosts(parse.cost, classification.cost),
    timeMs: Date.now() - startTime,
  };
}

// =========================================================================
// Split Pipeline — Continue Stage (after checkpoint confirmation)
// =========================================================================

export interface ContinueStageInput {
  rawText: string;
  classification: IngestionClassification;
  parse: ParseResult;
  copyrightFlag?: CopyrightFlag;
  /** User corrections from the checkpoint — injected into Pass B */
  userCorrections?: {
    correctedSectionCount?: number;
    correctionNote?: string;
  };
}

/**
 * Run Pass B + Extract + Copyright + Moderate.
 * Called after the user confirms/corrects at the interactive checkpoint.
 */
export async function runContinueStage(
  input: ContinueStageInput,
  config: PassConfig
): Promise<IngestionPipelineResult> {
  const startTime = Date.now();

  // Fetch teacher corrections for Pass B few-shot injection
  let corrections: IngestionCorrection[] = [];
  try {
    corrections = await fetchTeacherCorrections(config);
  } catch {
    // Advisory — never block
  }

  // Build correction context for Pass B
  const correctionContext = buildPassBCorrections(corrections);

  // If user provided a correction note at checkpoint, add it to the context
  let checkpointContext = "";
  if (input.userCorrections?.correctedSectionCount) {
    checkpointContext += `\n\nThe teacher has confirmed this document has exactly ${input.userCorrections.correctedSectionCount} lessons. Do NOT produce more or fewer enriched sections than this number.`;
  }
  if (input.userCorrections?.correctionNote) {
    checkpointContext += `\n\nTeacher note for this specific document: "${input.userCorrections.correctionNote}"`;
  }

  const passBConfig = (correctionContext || checkpointContext)
    ? { ...config, _correctionContext: correctionContext + checkpointContext }
    : config;

  // Stage I-3: Pass B — Analyse + Enrich
  const passB = ingestionPasses[1]; // pass-b-analyse
  const analysis = await passB.run(input.classification, passBConfig) as IngestionAnalysis & { cost: CostBreakdown };

  // Stage I-4: Block Extraction + Copyright
  const extractionRaw: ExtractionResult = extractBlocks(
    analysis,
    input.copyrightFlag || "unknown"
  );

  const copyrightCheck = await checkBlocksForCopyright(extractionRaw.blocks, config);
  const extraction: ExtractionResult = {
    ...extractionRaw,
    blocks: copyrightCheck.blocks,
    cost: {
      ...extractionRaw.cost,
      timeMs: extractionRaw.cost.timeMs + copyrightCheck.cost.timeMs,
    },
  };

  // Stage I-5: Haiku moderation
  const moderationRaw = await moderateExtractedBlocks(extraction.blocks, config);
  const moderation: ModerationStageResult = {
    blocks: moderationRaw.blocks,
    cost: moderationRaw.cost,
    approvedCount: moderationRaw.blocks.filter((b) => b.moderationStatus === "approved").length,
    flaggedCount: moderationRaw.blocks.filter((b) => b.moderationStatus === "flagged").length,
    pendingCount: moderationRaw.blocks.filter((b) => b.moderationStatus === "pending").length,
  };

  const zeroDedupCost: CostBreakdown = {
    inputTokens: 0, outputTokens: 0, modelId: "none",
    estimatedCostUSD: 0, timeMs: 0,
  };

  const totalCost = sumCosts(
    input.parse.cost,
    input.classification.cost,
    analysis.cost,
    extraction.cost,
    moderation.cost
  );

  return {
    dedup: { isDuplicate: false, fileHash: "", cost: zeroDedupCost },
    parse: input.parse,
    classification: input.classification,
    analysis,
    extraction,
    moderation,
    totalCost: { ...totalCost, timeMs: Date.now() - startTime },
    totalTimeMs: Date.now() - startTime,
  };
}
