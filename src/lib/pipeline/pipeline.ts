/**
 * Pipeline Simulator — Dimensions3 Phase A
 *
 * 6 exported functions, one per pipeline stage. Each takes the previous
 * stage's typed output and returns the next. All use hardcoded fixture data —
 * no AI calls, no database. CostBreakdown on every return.
 *
 * Decision 42: this is ONE file with 6 exported functions.
 *
 * @see docs/projects/dimensions3.md §7.6
 */

import type {
  CostBreakdown,
  GenerationRequest,
  BlockRetrievalResult,
  RetrievedBlock,
  AssembledSequence,
  LessonSlot,
  ActivitySlot,
  FilledSequence,
  FilledLesson,
  FilledActivity,
  PolishedSequence,
  PolishedLesson,
  PolishedActivity,
  TimedUnit,
  TimedLesson,
  TimedPhase,
  QualityReport,
  DimensionScore,
  ActivityBlock,
} from "@/types/activity-blocks";
import { getFormatProfile, type FormatProfile } from "@/lib/ai/unit-types";

// =========================================================================
// Zero-cost stub
// =========================================================================

const ZERO_COST: CostBreakdown = {
  inputTokens: 0,
  outputTokens: 0,
  modelId: "simulator",
  estimatedCostUSD: 0,
  timeMs: 0,
};

// =========================================================================
// Fixture Data
// =========================================================================

function makeFixtureBlock(overrides: Partial<ActivityBlock> & { title: string; prompt: string }): ActivityBlock {
  return {
    id: crypto.randomUUID(),
    teacher_id: null,
    description: null,
    source_type: "manual",
    source_upload_id: null,
    source_unit_id: null,
    source_page_id: null,
    source_activity_index: null,
    bloom_level: "apply",
    time_weight: "moderate",
    grouping: "individual",
    phase: null,
    activity_category: null,
    ai_rules: null,
    udl_checkpoints: [],
    success_look_fors: [],
    output_type: null,
    prerequisite_tags: [],
    lesson_structure_role: null,
    response_type: "long-text",
    toolkit_tool_id: null,
    materials_needed: [],
    tech_requirements: [],
    scaffolding: null,
    example_response: null,
    efficacy_score: 50,
    times_used: 0,
    times_skipped: 0,
    times_edited: 0,
    avg_time_spent: null,
    avg_completion_rate: null,
    source_format_hint: null,
    tags: [],
    is_assessable: false,
    assessment_config: null,
    interactive_config: null,
    supports_visual_assessment: false,
    pii_scanned: false,
    pii_flags: null,
    copyright_flag: "own",
    teacher_verified: false,
    module: "studioloom",
    media_asset_ids: [],
    is_public: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const FIXTURE_BLOCKS: ActivityBlock[] = [
  makeFixtureBlock({
    title: "User Research Interview",
    prompt: "Interview 2 potential users about their needs. Record key findings.",
    bloom_level: "understand",
    phase: "investigate",
    activity_category: "research",
    grouping: "pair",
    time_weight: "extended",
    output_type: "interview_notes",
    lesson_structure_role: "core",
  }),
  makeFixtureBlock({
    title: "Product Analysis Grid",
    prompt: "Analyse 3 existing products using the comparison grid. Identify strengths and weaknesses.",
    bloom_level: "analyze",
    phase: "investigate",
    activity_category: "analysis",
    time_weight: "moderate",
    output_type: "analysis_grid",
    lesson_structure_role: "core",
  }),
  makeFixtureBlock({
    title: "Design Brief Writing",
    prompt: "Write a clear design brief based on your research findings. Include target user, constraints, and success criteria.",
    bloom_level: "apply",
    phase: "develop",
    activity_category: "planning",
    time_weight: "moderate",
    prerequisite_tags: ["interview_notes", "analysis_grid"],
    lesson_structure_role: "core",
  }),
  makeFixtureBlock({
    title: "Rapid Sketching Session",
    prompt: "Generate 10 quick sketch ideas in 15 minutes. Focus on quantity over quality.",
    bloom_level: "create",
    phase: "develop",
    activity_category: "ideation",
    grouping: "individual",
    time_weight: "quick",
    output_type: "sketch_collection",
    lesson_structure_role: "core",
  }),
  makeFixtureBlock({
    title: "Prototype Build",
    prompt: "Build a working prototype of your selected design using available materials.",
    bloom_level: "create",
    phase: "create",
    activity_category: "making",
    grouping: "individual",
    time_weight: "extended",
    prerequisite_tags: ["sketch_collection"],
    output_type: "physical_prototype",
    materials_needed: ["cardboard", "tape", "scissors"],
    lesson_structure_role: "core",
  }),
  makeFixtureBlock({
    title: "Peer Critique Gallery Walk",
    prompt: "Display your prototype. Visit 3 peers' work and leave structured feedback using Two Stars & a Wish.",
    bloom_level: "evaluate",
    phase: "evaluate",
    activity_category: "critique",
    grouping: "whole_class",
    time_weight: "moderate",
    prerequisite_tags: ["physical_prototype"],
    lesson_structure_role: "core",
  }),
  makeFixtureBlock({
    title: "Opening: Design Challenge Reveal",
    prompt: "Watch the 2-minute design challenge video. What is the real problem here?",
    bloom_level: "remember",
    phase: "investigate",
    activity_category: "warmup",
    time_weight: "quick",
    lesson_structure_role: "opening",
  }),
  makeFixtureBlock({
    title: "Reflection Journal",
    prompt: "What did you learn about yourself as a designer today? What would you do differently?",
    bloom_level: "evaluate",
    phase: "evaluate",
    activity_category: "reflection",
    time_weight: "quick",
    lesson_structure_role: "reflection",
  }),
];

// =========================================================================
// Stage 0: Input Validation
// =========================================================================

export function stage0_validateInput(request: GenerationRequest): {
  request: GenerationRequest;
  profile: FormatProfile;
  cost: CostBreakdown;
} {
  const profile = getFormatProfile(request.unitType);
  return { request, profile, cost: { ...ZERO_COST } };
}

// =========================================================================
// Stage 1: Block Retrieval (simulated)
// =========================================================================

export function stage1_retrieveBlocks(
  request: GenerationRequest,
  profile: FormatProfile
): BlockRetrievalResult {
  const startMs = Date.now();

  // Simple keyword matching against fixture blocks
  const topicLower = request.topic.toLowerCase();
  const candidates: RetrievedBlock[] = FIXTURE_BLOCKS.map((block) => {
    let score = 0.3; // base relevance

    // Keyword match
    if (block.title.toLowerCase().includes(topicLower.slice(0, 8))) score += 0.2;

    // Phase match — boost blocks whose phase is in the profile's phaseIds
    if (block.phase && profile.blockRelevance.phaseIds.includes(block.phase)) score += 0.15;

    // Category boost/suppress
    if (block.activity_category && profile.blockRelevance.boost.includes(block.activity_category)) score += 0.1;
    if (block.activity_category && profile.blockRelevance.suppress.includes(block.activity_category)) score -= 0.2;

    // Efficacy signal
    score += (block.efficacy_score / 100) * 0.1;

    return {
      block,
      relevanceScore: Math.max(0, Math.min(1, score)),
      scoreBreakdown: {
        vectorSimilarity: 0.3,
        efficacyNormalized: block.efficacy_score / 100,
        textMatch: topicLower.length > 5 ? 0.2 : 0.1,
        usageSignal: 0.1,
        metadataFit: score - 0.3,
      },
    };
  })
    .filter((c) => c.relevanceScore > 0.2)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    request,
    candidates,
    retrievalMetrics: {
      totalBlocksSearched: FIXTURE_BLOCKS.length,
      candidatesReturned: candidates.length,
      avgRelevanceScore: candidates.length > 0
        ? candidates.reduce((s, c) => s + c.relevanceScore, 0) / candidates.length
        : 0,
      retrievalTimeMs: Date.now() - startMs,
      retrievalCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
    },
  };
}

// =========================================================================
// Stage 2: Sequence Assembly (simulated)
// =========================================================================

export function stage2_assembleSequence(
  retrieval: BlockRetrievalResult,
  profile: FormatProfile
): AssembledSequence {
  const startMs = Date.now();
  const { request, candidates } = retrieval;
  const lessonCount = request.lessonCount || 6;

  // Distribute phases across lessons based on phaseWeights
  const phases = profile.phases;
  const phaseWeights = profile.sequenceHints.phaseWeights;
  const lessons: LessonSlot[] = [];

  for (let i = 0; i < lessonCount; i++) {
    const progress = i / lessonCount;
    // Pick the phase that should dominate at this point in the unit
    let bestPhase = phases[0];
    let cumWeight = 0;
    for (const phase of phases) {
      cumWeight += phaseWeights[phase.id] || (1 / phases.length);
      if (progress < cumWeight) {
        bestPhase = phase;
        break;
      }
    }

    // Find matching blocks from candidates
    const matchingBlocks = candidates.filter(
      (c) => c.block.phase === bestPhase.id
    );

    const activities: ActivitySlot[] = [];

    if (matchingBlocks.length > 0) {
      // Use library block
      activities.push({
        slotIndex: 0,
        source: "library",
        block: matchingBlocks[0],
      });
    } else {
      // Gap — needs generation
      activities.push({
        slotIndex: 0,
        source: "gap",
        gapDescription: `${bestPhase.label} activity for "${request.topic}"`,
        gapContext: {
          suggestedPhase: bestPhase.id,
          suggestedBloom: i < lessonCount / 3 ? "understand" : i < (2 * lessonCount) / 3 ? "apply" : "evaluate",
          suggestedCategory: profile.blockRelevance.boost[0] || "research",
          suggestedTimeWeight: "moderate",
          suggestedLessonRole: "core",
        },
      });
    }

    lessons.push({
      position: i + 1,
      label: `Lesson ${i + 1}: ${bestPhase.label}`,
      description: `${bestPhase.description} — focused on "${request.topic}"`,
      activities,
    });
  }

  const filledCount = lessons.reduce(
    (sum, l) => sum + l.activities.filter((a) => a.source === "library").length,
    0
  );
  const totalSlots = lessons.reduce((sum, l) => sum + l.activities.length, 0);

  return {
    request,
    lessons,
    sequenceMetrics: {
      totalSlots,
      filledFromLibrary: filledCount,
      gapsToGenerate: totalSlots - filledCount,
      fillRate: totalSlots > 0 ? filledCount / totalSlots : 0,
      prerequisiteViolations: [],
      sequenceTimeMs: Date.now() - startMs,
      sequenceCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
    },
  };
}

// =========================================================================
// Stage 3: Gap Fill (simulated — no AI)
// =========================================================================

export function stage3_fillGaps(
  assembled: AssembledSequence,
  profile: FormatProfile
): FilledSequence {
  const startMs = Date.now();
  const { request, lessons: assembledLessons } = assembled;
  let gapsFilled = 0;

  const lessons: FilledLesson[] = assembledLessons.map((lesson) => {
    const activities: FilledActivity[] = lesson.activities.map((slot) => {
      if (slot.source === "library" && slot.block) {
        const b = slot.block.block;
        return {
          source: "library" as const,
          sourceBlockId: b.id,
          title: b.title,
          prompt: b.prompt,
          bloom_level: b.bloom_level || "apply",
          time_weight: b.time_weight,
          grouping: b.grouping,
          phase: b.phase || "",
          activity_category: b.activity_category || "research",
          lesson_structure_role: b.lesson_structure_role || "core",
          response_type: b.response_type || "long-text",
          materials_needed: b.materials_needed,
          scaffolding: b.scaffolding,
          ai_rules: b.ai_rules,
          udl_checkpoints: b.udl_checkpoints,
          success_look_fors: b.success_look_fors,
        };
      }

      // Gap fill — simulated with [GENERATED] marker
      gapsFilled++;
      const ctx = slot.gapContext;
      return {
        source: "generated" as const,
        title: `[GENERATED] ${slot.gapDescription || "Activity"}`,
        prompt: `[GENERATED] Complete this ${ctx?.suggestedCategory || "activity"} task for "${request.topic}".`,
        bloom_level: ctx?.suggestedBloom || "apply",
        time_weight: ctx?.suggestedTimeWeight || "moderate",
        grouping: ctx?.suggestedGrouping || "individual",
        phase: ctx?.suggestedPhase || "",
        activity_category: ctx?.suggestedCategory || "research",
        lesson_structure_role: ctx?.suggestedLessonRole || "core",
        response_type: "long-text",
        materials_needed: [],
      };
    });

    return {
      position: lesson.position,
      label: lesson.label,
      description: lesson.description,
      learningGoal: `Students will develop ${profile.cycleName} skills through "${request.topic}"`,
      activities,
    };
  });

  return {
    request,
    lessons,
    generationMetrics: {
      gapsFilled,
      totalTokensUsed: 0,
      totalCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
      generationTimeMs: Date.now() - startMs,
      perGapMetrics: [],
    },
  };
}

// =========================================================================
// Stage 4: Polish (simulated — adds [POLISHED] markers)
// =========================================================================

export function stage4_polish(
  filled: FilledSequence,
  _profile: FormatProfile
): PolishedSequence {
  const startMs = Date.now();
  let transitionsAdded = 0;

  const lessons: PolishedLesson[] = filled.lessons.map((lesson, li) => {
    const activities: PolishedActivity[] = lesson.activities.map((act, ai) => {
      const polished: PolishedActivity = {
        ...act,
        transitionIn: li > 0 || ai > 0
          ? `[POLISHED] Building on what you explored in the previous activity...`
          : undefined,
        crossReferences: [],
      };
      if (polished.transitionIn) transitionsAdded++;
      return polished;
    });

    return { ...lesson, activities };
  });

  return {
    request: filled.request,
    lessons,
    polishMetrics: {
      transitionsAdded,
      crossReferencesAdded: 0,
      familiarityAdaptations: 0,
      scaffoldingProgressions: 0,
      totalTokensUsed: 0,
      totalCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
      polishTimeMs: Date.now() - startMs,
    },
    interactionMap: [],
  };
}

// =========================================================================
// Stage 5: Timing (simulated — simple arithmetic)
// =========================================================================

export function stage5_applyTiming(
  polished: PolishedSequence,
  profile: FormatProfile
): TimedUnit {
  const startMs = Date.now();
  const periodMinutes = polished.request.constraints.periodMinutes || 60;
  const setupBuffer = profile.timingModifiers.setupBuffer;
  const usableMinutes = periodMinutes - setupBuffer - 5; // 5 min transition

  const lessons: TimedLesson[] = polished.lessons.map((lesson) => {
    // Equal time per activity
    const activityCount = lesson.activities.length || 1;
    const perActivityMinutes = Math.floor(usableMinutes / activityCount);

    // Group activities into a single "Work Time" phase
    const phases: TimedPhase[] = [
      {
        label: "Opening",
        phaseId: "opening",
        activities: [],
        durationMinutes: 5,
        isFlexible: false,
      },
      {
        label: "Work Time",
        phaseId: "work",
        activities: lesson.activities,
        durationMinutes: usableMinutes - 10,
        isFlexible: true,
      },
      {
        label: "Debrief",
        phaseId: "debrief",
        activities: [],
        durationMinutes: 5,
        isFlexible: false,
      },
    ];

    return {
      ...lesson,
      phases,
      totalMinutes: periodMinutes,
      extensions: [
        {
          title: "Extension: Go Deeper",
          description: `Extend your ${lesson.label} work with an additional challenge.`,
          duration: 15,
        },
      ],
    };
  });

  return {
    request: polished.request,
    lessons,
    timingMetrics: {
      totalMinutesAllocated: lessons.length * periodMinutes,
      totalMinutesAvailable: lessons.length * periodMinutes,
      overflowLessons: [],
      timingSource: "starter_default",
      timingTimeMs: Date.now() - startMs,
      timingCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
    },
  };
}

// =========================================================================
// Stage 6: Quality Scoring (simulated — deterministic)
// =========================================================================

export function stage6_scoreQuality(
  timed: TimedUnit,
  profile: FormatProfile
): QualityReport {
  const lessons = timed.lessons;
  const allActivities = lessons.flatMap((l) => l.activities);

  // Count bloom levels
  const bloomDist: Record<string, number> = {};
  const groupDist: Record<string, number> = {};
  const phasesUsed = new Set<string>();
  const categoriesUsed = new Set<string>();
  let libraryCount = 0;

  for (const act of allActivities) {
    bloomDist[act.bloom_level] = (bloomDist[act.bloom_level] || 0) + 1;
    groupDist[act.grouping] = (groupDist[act.grouping] || 0) + 1;
    if (act.phase) phasesUsed.add(act.phase);
    if (act.activity_category) categoriesUsed.add(act.activity_category);
    if (act.source === "library") libraryCount++;
  }

  const total = allActivities.length || 1;

  function makeDimensionScore(base: number): DimensionScore {
    return {
      score: Math.min(10, Math.max(0, base)),
      confidence: total > 6 ? 0.8 : 0.5,
      subScores: {},
      flags: base < 4 ? ["Needs improvement"] : [],
    };
  }

  // Higher scores for more variety
  const bloomVariety = Object.keys(bloomDist).length;
  const groupVariety = Object.keys(groupDist).length;

  const cr = makeDimensionScore(Math.min(10, bloomVariety * 2));
  const sa = makeDimensionScore(Math.min(10, groupVariety * 2.5));
  const tc = makeDimensionScore(Math.min(10, categoriesUsed.size * 1.5));
  const variety = makeDimensionScore(Math.min(10, (bloomVariety + groupVariety + categoriesUsed.size) / 1.5));
  const coherence = makeDimensionScore(libraryCount > 0 ? 7 : 5);

  const overall = (
    cr.score * profile.pulseWeights.cognitiveRigour +
    sa.score * profile.pulseWeights.studentAgency +
    tc.score * profile.pulseWeights.teacherCraft
  ) * 0.7 + variety.score * 0.15 + coherence.score * 0.15;

  const perLessonCost: CostBreakdown[] = lessons.map(() => ({ ...ZERO_COST }));
  const perStageCost: Record<string, CostBreakdown> = {};
  for (let i = 0; i <= 6; i++) perStageCost[String(i)] = { ...ZERO_COST };

  return {
    overallScore: Math.round(overall * 10) / 10,
    dimensions: {
      cognitiveRigour: cr,
      studentAgency: sa,
      teacherCraft: tc,
      variety,
      coherence,
    },
    coverage: {
      bloomDistribution: bloomDist,
      groupingDistribution: groupDist,
      udlCheckpointsCovered: [],
      udlCheckpointsMissing: [],
      phasesCovered: Array.from(phasesUsed),
      categoriesCovered: Array.from(categoriesUsed),
    },
    libraryMetrics: {
      blockReuseRate: libraryCount / total,
      avgBlockEfficacy: 50,
      newBlocksGenerated: total - libraryCount,
    },
    costSummary: {
      totalCost: { ...ZERO_COST },
      perLessonCost,
      perStageCost,
    },
    recommendations: [
      bloomVariety < 4 ? "Add activities at higher Bloom levels (Evaluate, Create)" : "",
      groupVariety < 3 ? "Include more collaborative activities (pair, small group)" : "",
      libraryCount === 0 ? "No blocks from library — build up your block library for better results" : "",
    ].filter(Boolean),
  };
}

// =========================================================================
// Full Pipeline Runner
// =========================================================================

export interface PipelineResult {
  timedUnit: TimedUnit;
  qualityReport: QualityReport;
  stageTimings: Record<string, number>;
}

/**
 * Run the full simulated pipeline end-to-end.
 * Returns the final TimedUnit + QualityReport + per-stage timings.
 */
export function runSimulatedPipeline(request: GenerationRequest): PipelineResult {
  const timings: Record<string, number> = {};

  let t0 = Date.now();
  const { request: validatedReq, profile } = stage0_validateInput(request);
  timings["stage0"] = Date.now() - t0;

  t0 = Date.now();
  const retrieval = stage1_retrieveBlocks(validatedReq, profile);
  timings["stage1"] = Date.now() - t0;

  t0 = Date.now();
  const assembled = stage2_assembleSequence(retrieval, profile);
  timings["stage2"] = Date.now() - t0;

  t0 = Date.now();
  const filled = stage3_fillGaps(assembled, profile);
  timings["stage3"] = Date.now() - t0;

  t0 = Date.now();
  const polished = stage4_polish(filled, profile);
  timings["stage4"] = Date.now() - t0;

  t0 = Date.now();
  const timedUnit = stage5_applyTiming(polished, profile);
  timings["stage5"] = Date.now() - t0;

  t0 = Date.now();
  const qualityReport = stage6_scoreQuality(timedUnit, profile);
  timings["stage6"] = Date.now() - t0;

  return { timedUnit, qualityReport, stageTimings: timings };
}
