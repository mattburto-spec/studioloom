/**
 * Sub-task 5.8 — stage6_scoreQuality pulseWeights wiring test.
 *
 * 1 regression test locking stage6-scoring.ts pulseWeights wiring.
 *
 * Strategy:
 *   - Build ONE PolishedSequence and run stage5_applyTiming ONCE → shared TimedUnit.
 *   - Score that TimedUnit with 3 SYNTHETIC profiles cloned from real "design" with
 *     orthogonal pulseWeights: {1,0,0}, {0,1,0}, {0,0,1}.
 *   - Assert the 3 overallScores are pairwise distinct.
 *
 * Why extreme orthogonal (not 0.05-nudged) weights:
 *   stage6 rounds overallScore to 1 decimal place (line 331). Close weight
 *   configurations can collapse to the same rounded score. {1,0,0}/{0,1,0}/{0,0,1}
 *   maximise the spread between CR / SA / TC contributions so the rounding cannot
 *   mask the wiring.
 *
 * Why share one TimedUnit (not per-profile stage5 runs):
 *   The existing test at stages.test.ts:421-437 is confounded — it runs stage5
 *   separately per profile (different timingModifiers → different TimedUnits), so
 *   it would still pass even if stage6 hardcoded its weights. By freezing stage5
 *   output, this test isolates stage6 pulseWeights consumption.
 *
 * Sanity guard:
 *   Score the shared TimedUnit with a neutral profile so we can assert cr/sa/tc
 *   are non-degenerate (not all 0, not all identical). If they were, the orthogonal
 *   weight experiment would be meaningless.
 *
 * Negative control: replace `profile.pulseWeights.{cognitiveRigour,studentAgency,
 * teacherCraft}` at lines 320-322 with `(1/3)` — the 3 overallScores collapse to
 * identical values, pairwise `.not.toBe()` assertions fire.
 *
 * Followups surfaced during 5.8 pre-flight audit (not in scope for this sub-task):
 *   FU-A: src/lib/pipeline/pipeline.ts:545-605 contains a SECOND stage6_scoreQuality
 *         (simulator variant used by runSimulatedPipeline). Lines 590-592 also read
 *         profile.pulseWeights.* and should get a parallel wiring test in a future pass.
 *   FU-B: pulseWeights across all 4 profiles drift by 0.05 from the values in
 *         docs/specs/format-profile-definitions.md. Spec-vs-code sync needed.
 */
import { describe, it, expect } from "vitest";
import { stage5_applyTiming } from "../stage5-timing";
import { stage6_scoreQuality } from "../stage6-scoring";
import { getFormatProfile } from "@/lib/ai/unit-types";
import type { FormatProfile } from "@/lib/ai/unit-types";
import type {
  GenerationRequest,
  FilledActivity,
  FilledLesson,
  FilledSequence,
  PolishedLesson,
  PolishedSequence,
  CostBreakdown,
} from "@/types/activity-blocks";

// ─── Helpers ───

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "test",
  estimatedCostUSD: 0, timeMs: 0,
};

const DESIGN_REQUEST: GenerationRequest = {
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

// Ported verbatim from src/lib/pipeline/__tests__/stages.test.ts (not exported).
function makeFilledActivity(overrides: Partial<FilledActivity> = {}): FilledActivity {
  return {
    source: "generated",
    title: "Test Activity",
    prompt: "Do the thing.",
    bloom_level: "apply",
    time_weight: "moderate",
    grouping: "individual",
    phase: "investigate",
    activity_category: "research",
    lesson_structure_role: "core",
    response_type: "long-text",
    materials_needed: [],
    scaffolding: { hints: ["Hint 1"], sentence_starters: ["Consider..."] },
    ai_rules: { phase: "neutral", tone: "supportive", rules: ["Be helpful"] },
    udl_checkpoints: ["5.1"],
    success_look_fors: ["Student can..."],
    ...overrides,
  };
}

function makeFilledSequence(
  request: GenerationRequest,
  lessonCount: number,
  activitiesPerLesson: number = 3
): FilledSequence {
  const blooms = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
  const groupings = ["individual", "pair", "small_group", "whole_class", "flexible"];
  const categories = ["research", "analysis", "ideation", "making", "critique", "reflection"];

  const lessons: FilledLesson[] = Array.from({ length: lessonCount }, (_, li) => ({
    position: li + 1,
    label: `Lesson ${li + 1}`,
    description: `Lesson ${li + 1} description`,
    learningGoal: "Students will...",
    activities: Array.from({ length: activitiesPerLesson }, (_, ai) => {
      const idx = li * activitiesPerLesson + ai;
      return makeFilledActivity({
        title: `Activity ${li + 1}.${ai + 1}`,
        bloom_level: blooms[idx % blooms.length],
        grouping: groupings[idx % groupings.length] as FilledActivity["grouping"],
        activity_category: categories[idx % categories.length],
        lesson_structure_role: ai === 0 ? "opening" : ai === activitiesPerLesson - 1 ? "reflection" : "core",
        time_weight: ai === 0 ? "quick" : ai === activitiesPerLesson - 1 ? "quick" : "extended",
      });
    }),
  }));

  return {
    request,
    lessons,
    generationMetrics: {
      gapsFilled: lessonCount * activitiesPerLesson,
      totalTokensUsed: 0,
      totalCost: { ...ZERO_COST },
      generationTimeMs: 0,
      perGapMetrics: [],
    },
  };
}

function makePolishedSequence(
  request: GenerationRequest,
  lessonCount: number,
  activitiesPerLesson: number = 3
): PolishedSequence {
  const filled = makeFilledSequence(request, lessonCount, activitiesPerLesson);
  const lessons: PolishedLesson[] = filled.lessons.map(l => ({
    ...l,
    activities: l.activities.map(a => ({
      ...a,
      transitionIn: "Building on the previous work...",
      crossReferences: [],
    })),
  }));

  return {
    request,
    lessons,
    polishMetrics: {
      transitionsAdded: lessonCount * activitiesPerLesson,
      crossReferencesAdded: 0,
      familiarityAdaptations: 0,
      scaffoldingProgressions: 0,
      totalTokensUsed: 0,
      totalCost: { ...ZERO_COST },
      polishTimeMs: 0,
    },
    interactionMap: [],
  };
}

/**
 * Clone a real profile with overridden pulseWeights. Preserves all other fields
 * (timingModifiers, blockRelevance, connectiveTissue, etc.) so stage5 input is
 * unaffected and only stage6 weighting changes.
 */
function makeSyntheticProfile(
  base: FormatProfile,
  pulseWeights: FormatProfile["pulseWeights"]
): FormatProfile {
  return { ...base, pulseWeights };
}

// ─── Test ───

describe("stage6_scoreQuality — pulseWeights wiring (5.8)", () => {
  it("reads pulseWeights from FormatProfile — 3 orthogonal synthetic profiles → 3 distinct overallScores on shared TimedUnit", () => {
    const baseDesign = getFormatProfile("design");

    // Build ONE PolishedSequence and run stage5 ONCE — freezes the TimedUnit
    // input so any overallScore differences can only come from stage6 weighting.
    const polished = makePolishedSequence(DESIGN_REQUEST, 6, 3);
    const timed = stage5_applyTiming(polished, baseDesign);

    // Sanity guard: assert the three dimensions are non-degenerate under a
    // neutral profile. If cr === sa === tc, orthogonal weighting cannot diverge
    // the overall score and the test below would pass vacuously even under the NC.
    const neutralReport = stage6_scoreQuality(timed, baseDesign);
    const { cognitiveRigour: crDim, studentAgency: saDim, teacherCraft: tcDim } = neutralReport.dimensions;
    expect(crDim.score).toBeGreaterThan(0);
    expect(saDim.score).toBeGreaterThan(0);
    expect(tcDim.score).toBeGreaterThan(0);
    // At least two of the three must differ — otherwise orthogonal weighting is a no-op.
    const allEqual = crDim.score === saDim.score && saDim.score === tcDim.score;
    expect(allEqual, `cr/sa/tc all equal (${crDim.score}) — orthogonal weighting would collapse`).toBe(false);

    // Orthogonal synthetic profiles.
    const crOnly = makeSyntheticProfile(baseDesign, {
      cognitiveRigour: 1, studentAgency: 0, teacherCraft: 0,
    });
    const saOnly = makeSyntheticProfile(baseDesign, {
      cognitiveRigour: 0, studentAgency: 1, teacherCraft: 0,
    });
    const tcOnly = makeSyntheticProfile(baseDesign, {
      cognitiveRigour: 0, studentAgency: 0, teacherCraft: 1,
    });

    const crReport = stage6_scoreQuality(timed, crOnly);
    const saReport = stage6_scoreQuality(timed, saOnly);
    const tcReport = stage6_scoreQuality(timed, tcOnly);

    // Pairwise distinctness — any 2 collapsing would indicate stage6 is not
    // reading weights from the profile (or reading them selectively).
    expect(
      crReport.overallScore,
      `crOnly vs saOnly collapsed to ${crReport.overallScore}`
    ).not.toBe(saReport.overallScore);
    expect(
      crReport.overallScore,
      `crOnly vs tcOnly collapsed to ${crReport.overallScore}`
    ).not.toBe(tcReport.overallScore);
    expect(
      saReport.overallScore,
      `saOnly vs tcOnly collapsed to ${saReport.overallScore}`
    ).not.toBe(tcReport.overallScore);
  });
});
