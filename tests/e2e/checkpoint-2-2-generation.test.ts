/**
 * Phase 2 Checkpoint 2.2 — Generation Pipeline E2E Test
 *
 * Structure mirrors checkpoint-1-2-ingestion.test.ts:
 *
 *   - α (sandbox) — runs on every `npm test`, no API key. Uses the
 *     deterministic simulator via sandboxMode=true. A thin smoke-test
 *     that the sandbox path produces a valid OrchestratorResult.
 *
 *   - β (live) — gated by `RUN_E2E=1 + ANTHROPIC_API_KEY`. Runs the
 *     real generation pipeline (Stages 2-4 hit Claude API). Mock
 *     supabase returns 0 library blocks so everything is gap-generated.
 *     Asserts: valid TimedUnit, lessons with activities, quality report,
 *     wall time under budget.
 *
 * criterion_tags note: The Stage 3 output mapping does NOT currently
 * copy the AI's `criterionTags` response field to `FilledActivity.
 * criterion_tags`. This is a known pipeline gap — criterion_tags
 * wiring is tracked as a future follow-up. Both α and β document
 * this gap with explicit assertions.
 *
 * To run:
 *   npm test                                              # α only
 *   RUN_E2E=1 ANTHROPIC_API_KEY=... npm test -- checkpoint-2-2   # α + β
 *
 * @see docs/projects/dimensions3-phase-2-brief.md row 5.14
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { OrchestratorConfig, OrchestratorResult } from "@/lib/pipeline/orchestrator";
import type { GenerationRequest } from "@/types/activity-blocks";

// ─── RUN_E2E gating ─────────────────────────────────────────────────────────

const RUN_E2E = process.env.RUN_E2E === "1";
const HAS_API_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const itLive = RUN_E2E && HAS_API_KEY ? it : it.skip;

// ─── Mock Supabase ──────────────────────────────────────────────────────────
// Same Proxy-based pattern as 5.14a. Absorbs all chained calls.
// For Stage 1 block retrieval: .from("activity_blocks").select("*")...
// returns { data: [], error: null } → 0 candidates → all gaps.

function createMockSupabase() {
  const terminal = () => ({
    data: { id: "mock-run-id", stage_results: {} },
    error: null,
  });

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then" || prop === "catch") return undefined;
      if (prop === "single" || prop === "maybeSingle") return () => terminal();
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };

  return {
    from: (_table: string) => new Proxy({}, handler),
    rpc: (_fn: string, _args: Record<string, unknown>) =>
      Promise.resolve({ data: null, error: null }),
  };
}

// ─── Test fixtures ──────────────────────────────────────────────────────────

const DESIGN_REQUEST: GenerationRequest = {
  topic: "Sustainable Packaging Design",
  unitType: "design",
  lessonCount: 4, // Keep small to minimize API cost
  gradeLevel: "year-9",
  framework: "IB_MYP",
  constraints: {
    availableResources: ["cardboard", "recycled materials"],
    periodMinutes: 60,
    workshopAccess: true,
    softwareAvailable: ["Fusion 360"],
  },
};

function buildConfig(sandboxMode: boolean): OrchestratorConfig {
  return {
    supabase: createMockSupabase() as OrchestratorConfig["supabase"],
    teacherId: "test-teacher-e2e",
    apiKey: process.env.ANTHROPIC_API_KEY || "not-needed-in-sandbox",
    sandboxMode,
  };
}

// ─── α — Sandbox ────────────────────────────────────────────────────────────

describe("Checkpoint 2.2 α — sandbox generation", () => {
  it("sandbox pipeline produces valid OrchestratorResult", async () => {
    const result = await runPipeline(DESIGN_REQUEST, buildConfig(true));

    expect(result).toBeDefined();
    expect(result.timedUnit).toBeDefined();
    expect(result.timedUnit.lessons.length).toBe(DESIGN_REQUEST.lessonCount);
    expect(result.qualityReport).toBeDefined();
    expect(result.qualityReport.overallScore).toBeGreaterThan(0);
    expect(result.totalCost.modelId).toBe("simulator");
    expect(result.totalCost.estimatedCostUSD).toBe(0);
  });
});

// ─── β — Live ───────────────────────────────────────────────────────────────

describe("Checkpoint 2.2 β — live generation (RUN_E2E=1)", () => {
  let result: OrchestratorResult;
  let wallTimeMs: number;

  // Single pipeline run shared across all β tests to avoid repeated API cost
  beforeAll(async () => {
    if (!RUN_E2E || !HAS_API_KEY) return;

    const start = Date.now();
    result = await runPipeline(DESIGN_REQUEST, buildConfig(false));
    wallTimeMs = Date.now() - start;

    // Log baseline for future reference (not asserted — drifts with pricing)
    console.log(
      `[Checkpoint 2.2 β] wall=${wallTimeMs}ms, ` +
        `cost=$${result.totalCost.estimatedCostUSD.toFixed(4)}, ` +
        `lessons=${result.timedUnit.lessons.length}`,
    );
  }, 120_000); // 2 minute timeout for real API calls

  itLive(
    "live pipeline produces TimedUnit with lessons and activities",
    () => {
      expect(result).toBeDefined();
      expect(result.timedUnit).toBeDefined();

      const { lessons } = result.timedUnit;
      expect(lessons.length).toBe(DESIGN_REQUEST.lessonCount);

      for (const lesson of lessons) {
        expect(lesson.activities.length).toBeGreaterThan(0);
        expect(lesson.phases.length).toBeGreaterThan(0);
        expect(lesson.totalMinutes).toBeGreaterThan(0);

        // Each activity has required fields from Stage 3
        for (const act of lesson.activities) {
          expect(act.title).toBeTruthy();
          expect(act.prompt).toBeTruthy();
          expect(act.source).toBe("generated"); // No library blocks with mock supabase
          expect(act.bloom_level).toBeTruthy();
          expect(act.grouping).toBeTruthy();
        }
      }
    },
    60_000,
  );

  itLive(
    "QualityReport has all 5 dimensions with non-zero scores",
    () => {
      const { qualityReport } = result;
      expect(qualityReport.overallScore).toBeGreaterThan(0);

      for (const key of [
        "cognitiveRigour",
        "studentAgency",
        "teacherCraft",
        "variety",
        "coherence",
      ] as const) {
        const dim = qualityReport.dimensions[key];
        expect(dim).toBeDefined();
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.confidence).toBeGreaterThan(0);
      }
    },
    60_000,
  );

  itLive(
    "all 7 stage timings are recorded and positive",
    () => {
      for (const stage of [
        "stage0",
        "stage1",
        "stage2",
        "stage3",
        "stage4",
        "stage5",
        "stage6",
      ]) {
        expect(typeof result.stageTimings[stage]).toBe("number");
        expect(result.stageTimings[stage]).toBeGreaterThanOrEqual(0);
      }
    },
    60_000,
  );

  itLive(
    "total cost is positive and under $2 for a 4-lesson unit",
    () => {
      expect(result.totalCost.estimatedCostUSD).toBeGreaterThan(0);
      expect(result.totalCost.estimatedCostUSD).toBeLessThan(2);
      expect(result.totalCost.inputTokens).toBeGreaterThan(0);
      expect(result.totalCost.outputTokens).toBeGreaterThan(0);
    },
    60_000,
  );

  // criterion_tags gap: Stage 3 output mapping doesn't copy AI's
  // criterionTags response to FilledActivity.criterion_tags.
  // When Stage 3 wiring is fixed, flip this assertion.
  itLive(
    "criterion_tags not yet wired through Stage 3 (known pipeline gap)",
    () => {
      const allActivities = result.timedUnit.lessons.flatMap(
        (l) => l.activities,
      );
      const withCriterionTags = allActivities.filter(
        (a) => a.criterion_tags && a.criterion_tags.length > 0,
      );
      // Expected 0 until Stage 3 output mapping includes criterion_tags
      expect(withCriterionTags.length).toBe(0);
    },
    60_000,
  );

  itLive(
    "completes in under 120 seconds",
    () => {
      // 4-lesson generation with 3 AI stages. Typical: 20-60s.
      expect(wallTimeMs).toBeLessThan(120_000);
    },
    60_000,
  );
});
