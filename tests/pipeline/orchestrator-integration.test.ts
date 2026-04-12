/**
 * Phase 2 sub-step 5.14a — Orchestrator Integration Test (mocked AI)
 *
 * Runs the full 6-stage pipeline in sandbox mode (deterministic simulator,
 * no AI calls, no API key required). This is the seam-fit gate: it proves
 * Stage N output deserializes into Stage N+1 input without throwing.
 *
 * What it asserts:
 *   1. Pipeline completes without error
 *   2. OrchestratorResult has the expected structural shape
 *   3. TimedUnit contains lessons with activities (stage chain intact)
 *   4. QualityReport has all 5 dimension scores
 *   5. Stage timings are all recorded (stages 0-6)
 *   6. criterion_tags gap documented (simulator doesn't populate them)
 *   7. Completes in under 2 seconds
 *
 * The mock supabase client absorbs all generation-log calls without
 * hitting a real database. The orchestrator's logging is fire-and-forget
 * by design, so the mock just needs to not throw.
 *
 * @see docs/projects/dimensions3-phase-2-brief.md row 5.14a
 */

import { describe, it, expect } from "vitest";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { OrchestratorConfig } from "@/lib/pipeline/orchestrator";
import type { GenerationRequest } from "@/types/activity-blocks";

// ─── Mock Supabase ──────────────────────────────────────────────────────────
// Absorbs all chained Supabase calls: .from().insert().select().single(),
// .from().update().eq(), .from().select().eq().single(). Returns minimal
// valid responses so the generation-log functions don't throw.

function createMockSupabase() {
  const chainable: Record<string, (...args: unknown[]) => unknown> = {};

  // Terminal methods return { data, error }
  const terminal = () => ({ data: { id: "mock-run-id", stage_results: {} }, error: null });

  // Every method returns the chainable proxy (fluent API)
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then" || prop === "catch") return undefined; // not a promise
      if (prop === "single" || prop === "maybeSingle") return () => terminal();
      return (..._args: unknown[]) => new Proxy(chainable, handler);
    },
  };

  return {
    from: (_table: string) => new Proxy(chainable, handler),
    rpc: (_fn: string, _args: Record<string, unknown>) =>
      Promise.resolve({ data: null, error: null }),
  };
}

// ─── Test Request ───────────────────────────────────────────────────────────

const TEST_REQUEST: GenerationRequest = {
  topic: "Sustainable Packaging Design",
  unitType: "design",
  lessonCount: 6,
  gradeLevel: "year-9",
  framework: "IB_MYP",
  constraints: {
    availableResources: ["cardboard", "recycled materials"],
    periodMinutes: 60,
    workshopAccess: true,
    softwareAvailable: ["Fusion 360"],
  },
};

const TEST_CONFIG: OrchestratorConfig = {
  supabase: createMockSupabase() as OrchestratorConfig["supabase"],
  teacherId: "test-teacher-001",
  apiKey: "not-needed-in-sandbox",
  sandboxMode: true,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("orchestrator integration — sandboxed pipeline (5.14a)", () => {
  // Run the pipeline once, share the result across tests
  let result: Awaited<ReturnType<typeof runPipeline>>;
  let wallTimeMs: number;

  it("runs stages 0-6 without throwing and returns OrchestratorResult", async () => {
    const start = Date.now();
    result = await runPipeline(TEST_REQUEST, TEST_CONFIG);
    wallTimeMs = Date.now() - start;

    expect(result).toBeDefined();
    expect(result.timedUnit).toBeDefined();
    expect(result.qualityReport).toBeDefined();
    expect(result.stageTimings).toBeDefined();
    expect(result.totalCost).toBeDefined();
  });

  it("TimedUnit contains lessons with activities (stage chain intact)", () => {
    const { timedUnit } = result;

    // Stage 5 output: TimedUnit with lessons
    expect(timedUnit.lessons).toBeDefined();
    expect(timedUnit.lessons.length).toBeGreaterThan(0);

    // Each lesson has activities (from Stage 3 gap-fill → Stage 4 polish)
    for (const lesson of timedUnit.lessons) {
      expect(lesson.activities).toBeDefined();
      expect(lesson.activities.length).toBeGreaterThan(0);

      // Each lesson has timing phases (from Stage 5)
      expect(lesson.phases).toBeDefined();
      expect(lesson.phases.length).toBeGreaterThan(0);
      expect(typeof lesson.totalMinutes).toBe("number");
    }

    // Timing metrics from Stage 5
    expect(timedUnit.timingMetrics).toBeDefined();
    expect(typeof timedUnit.timingMetrics.totalMinutesAllocated).toBe("number");
    expect(typeof timedUnit.timingMetrics.totalMinutesAvailable).toBe("number");
  });

  it("QualityReport has all 5 dimension scores from Stage 6", () => {
    const { qualityReport } = result;

    expect(typeof qualityReport.overallScore).toBe("number");
    expect(qualityReport.overallScore).toBeGreaterThan(0);

    // All 5 dimensions
    const dims = qualityReport.dimensions;
    for (const key of [
      "cognitiveRigour",
      "studentAgency",
      "teacherCraft",
      "variety",
      "coherence",
    ] as const) {
      expect(dims[key]).toBeDefined();
      expect(typeof dims[key].score).toBe("number");
      expect(typeof dims[key].confidence).toBe("number");
    }

    // Coverage data
    expect(qualityReport.coverage).toBeDefined();
    expect(qualityReport.coverage.bloomDistribution).toBeDefined();
    expect(qualityReport.coverage.groupingDistribution).toBeDefined();

    // Library metrics
    expect(qualityReport.libraryMetrics).toBeDefined();
    expect(typeof qualityReport.libraryMetrics.blockReuseRate).toBe("number");
  });

  it("stage timings recorded for all 7 stages (0-6)", () => {
    const { stageTimings } = result;
    for (const stage of ["stage0", "stage1", "stage2", "stage3", "stage4", "stage5", "stage6"]) {
      expect(stageTimings[stage]).toBeDefined();
      expect(typeof stageTimings[stage]).toBe("number");
      expect(stageTimings[stage]).toBeGreaterThanOrEqual(0);
    }
  });

  it("total cost is zero in sandbox mode (no AI calls)", () => {
    expect(result.totalCost.estimatedCostUSD).toBe(0);
    expect(result.totalCost.modelId).toBe("simulator");
  });

  it("completes in under 2 seconds", () => {
    // Spec requires < 2s. Simulator is pure computation, typically < 50ms.
    expect(wallTimeMs).toBeLessThan(2000);
  });

  // ── criterion_tags gap documentation ──
  // The simulator (src/lib/pipeline/pipeline.ts) generates deterministic
  // fixture activities but does NOT populate criterion_tags on them.
  // This is a known gap — criterion_tags are populated by the real AI
  // stages (Stage 3 gap generation + Stage 4 polish) only.
  // A live E2E test (5.14) will assert criterion_tags propagation with
  // real Anthropic calls. This test documents the simulator limitation.
  it("criterion_tags not populated by simulator (known gap — see FU for live E2E)", () => {
    const allActivities = result.timedUnit.lessons.flatMap((l) => l.activities);
    const withCriterionTags = allActivities.filter(
      (a) => a.criterion_tags && a.criterion_tags.length > 0,
    );
    // Simulator doesn't populate criterion_tags — 0 is expected.
    // When/if the simulator is enhanced, update this assertion.
    expect(withCriterionTags.length).toBe(0);
  });
});
