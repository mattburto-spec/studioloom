/**
 * Ingestion Pipeline Orchestrator
 *
 * Runs: Dedup → Parse → Pass A → Pass B → Extract
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
import { passA } from "./pass-a";
import { passB } from "./pass-b";
import { extractBlocks } from "./extract";
import { checkBlocksForCopyright } from "./copyright-check";
import { moderateExtractedBlocks } from "./moderate";

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

  // Stage I-0: Dedup
  const dedup: DedupResult = await dedupCheck(input.rawText, config);

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

  // Stage I-2: Pass A — Classify + Tag
  const classification: IngestionClassification = await passA.run(parse, config);

  // Stage I-3: Pass B — Analyse + Enrich
  const analysis: IngestionAnalysis = await passB.run(classification, config);

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
