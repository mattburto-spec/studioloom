import { NextRequest, NextResponse } from "next/server";
import { extractBlocks } from "@/lib/ingestion/extract";
import { requireAdmin } from "@/lib/auth/require-admin";
import { reconstructUnit } from "@/lib/ingestion/unit-import";
import { computeEfficacyScore } from "@/lib/feedback/efficacy";
import { validateProposal, validateEfficacyChange } from "@/lib/feedback/guardrails";
import { computeEditDiffs } from "@/lib/feedback/edit-tracker";
import { analyzeSelfHealing } from "@/lib/feedback/self-healing";
import type { EnrichedSection, IngestionAnalysis, IngestionClassification, IngestionPipelineResult } from "@/lib/ingestion/types";
import type { CostBreakdown } from "@/types/activity-blocks";

const ZERO_COST: CostBreakdown = { inputTokens: 0, outputTokens: 0, modelId: "none", estimatedCostUSD: 0, timeMs: 0 };

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

function runTest(name: string, fn: () => void): TestResult {
  const start = Date.now();
  try {
    fn();
    return { name, passed: true, durationMs: Date.now() - start };
  } catch (e) {
    return { name, passed: false, durationMs: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const results: TestResult[] = [];

  // Test 1: Ingestion → Library
  results.push(runTest("Ingestion → Library (Block Extraction)", () => {
    const classification: IngestionClassification = {
      documentType: "lesson_plan",
      confidence: 0.9,
      confidences: { documentType: 0.9 },
      topic: "Bridge Design",
      sections: [],
      cost: ZERO_COST,
    };
    const enrichedSections: EnrichedSection[] = [
      { index: 0, heading: "Warm-up", content: "Students discuss bridge types", sectionType: "activity", bloom_level: "remember", time_weight: "quick", grouping: "whole_class", phase: "opening", activity_category: "warmup", materials: [] },
      { index: 1, heading: "Research", content: "Research structural principles", sectionType: "activity", bloom_level: "understand", time_weight: "moderate", grouping: "pair", phase: "discover", activity_category: "research", materials: [] },
    ];
    const analysis: IngestionAnalysis = { classification, enrichedSections, cost: ZERO_COST };
    const result = extractBlocks(analysis, "own");
    if (result.blocks.length !== 2) throw new Error(`Expected 2 blocks, got ${result.blocks.length}`);
    if (result.blocks[0].bloom_level !== "remember") throw new Error("Wrong bloom level");
  }));

  // Test 2: Reconstruction
  results.push(runTest("Library → Generation (Reconstruction)", () => {
    const fakeIngestion: IngestionPipelineResult = {
      dedup: { fileHash: "test", isDuplicate: false, cost: ZERO_COST },
      parse: { title: "Test", sections: [], totalWordCount: 100, headingCount: 2, cost: ZERO_COST },
      classification: { documentType: "lesson_plan", confidence: 0.9, confidences: { documentType: 0.9 }, topic: "Test", sections: [], cost: ZERO_COST },
      analysis: { classification: { documentType: "lesson_plan", confidence: 0.9, confidences: { documentType: 0.9 }, topic: "Test", sections: [], cost: ZERO_COST }, enrichedSections: [], cost: ZERO_COST },
      extraction: {
        blocks: [
          { tempId: "b1", title: "Opener", description: "d", prompt: "p", bloom_level: "remember", time_weight: "quick", grouping: "whole_class", phase: "opening", activity_category: "warmup", materials: [], source_section_index: 0, piiFlags: [], copyrightFlag: "own" },
        ],
        totalSectionsProcessed: 1, activitySectionsFound: 1, piiDetected: false, cost: ZERO_COST,
      },
      moderation: {
        blocks: [],
        cost: ZERO_COST,
        approvedCount: 0,
        flaggedCount: 0,
        pendingCount: 0,
      },
      totalCost: ZERO_COST,
      totalTimeMs: 50,
    };
    const reconstruction = reconstructUnit(fakeIngestion);
    if (reconstruction.totalBlocks !== 1) throw new Error("Wrong block count");
    if (reconstruction.lessons.length === 0) throw new Error("No lessons reconstructed");
  }));

  // Test 3: Efficacy Computation
  results.push(runTest("Efficacy Score Computation", () => {
    const score = computeEfficacyScore({
      blockId: "test", keptRate: 0.9, completionRate: 0.8, timeAccuracy: 0.85,
      deletionRate: 0.05, paceScore: 0.7, editRate: 0.15, evidenceCount: 20,
      signalBreakdown: { teacherInteractions: 10, studentCompletions: 8, timeObservations: 5, paceFeedbackCount: 3 },
    });
    if (score < 0 || score > 100) throw new Error(`Score out of range: ${score}`);
  }));

  // Test 4: Guardrail Validation
  results.push(runTest("Guardrail Validation", () => {
    const result = validateProposal({ field: "efficacy_score", currentValue: 50, proposedValue: 60, evidenceCount: 30 });
    if (!result.valid) throw new Error("Should be valid");
    const extreme = validateEfficacyChange(50, 200);
    if (extreme.clampedValue > 95) throw new Error("Should be clamped");
  }));

  // Test 5: Edit Tracking
  results.push(runTest("Edit Diff Detection", () => {
    const original = { pages: [{ id: "p1", title: "L1", sections: [{ activityId: "a1", title: "Research" }] }] };
    const saved = { pages: [{ id: "p1", title: "L1", sections: [{ activityId: "a2", title: "Build" }] }] };
    const diffs = computeEditDiffs(original, saved);
    if (diffs.length === 0) throw new Error("No diffs detected");
  }));

  // Test 6: Self-Healing
  results.push(runTest("Self-Healing Detection", () => {
    const proposals = analyzeSelfHealing([
      { id: "b1", title: "Test", time_weight: "quick", bloom_level: "understand", avg_time_spent: 20, avg_completion_rate: 0.8, times_used: 10, times_edited: 2, times_skipped: 0, efficacy_score: 50 },
    ]);
    const timeMismatch = proposals.find(p => p.trigger === "time_weight_mismatch");
    if (!timeMismatch) throw new Error("Should detect time_weight mismatch");
  }));

  const passed = results.filter(r => r.passed).length;
  return NextResponse.json({ total: results.length, passed, failed: results.length - passed, results });
}
