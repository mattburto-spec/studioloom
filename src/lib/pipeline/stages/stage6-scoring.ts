/**
 * Stage 6: Quality Scoring
 *
 * Scores the final unit across 5 dimensions, builds coverage maps,
 * computes library metrics, and generates recommendations.
 * Reuses scoring patterns from Lesson Pulse where applicable.
 */

import type {
  CostBreakdown,
  TimedUnit,
  QualityReport,
  DimensionScore,
  PolishedActivity,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";

// ─── Constants ───

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "computation",
  estimatedCostUSD: 0, timeMs: 0,
};

/** Bloom level → numeric score (from Lesson Pulse) */
const BLOOM_SCORES: Record<string, number> = {
  remember: 1, understand: 2, apply: 4, analyze: 6, evaluate: 8, create: 10,
};

/** Grouping variety contributes to Teacher Craft */
const GROUPING_VARIETY_TARGET = 4; // Using 4+ different groupings is ideal

/** UDL principles mapped from checkpoint ranges */
function mapUDLCheckpointToPrinciple(cp: string): string | null {
  const num = parseFloat(cp);
  if (isNaN(num)) return null;
  if (num >= 1 && num < 4) return "engagement";
  if (num >= 4 && num < 7) return "representation";
  if (num >= 7 && num <= 9.9) return "action_expression";
  return null;
}

// ─── Scoring Functions ───

function scoreCognitiveRigour(activities: PolishedActivity[]): DimensionScore {
  if (activities.length === 0) {
    return { score: 0, confidence: 0, subScores: {}, flags: ["No activities to score"] };
  }

  // Bloom level variety and progression
  const bloomScores = activities.map(a => BLOOM_SCORES[a.bloom_level] || 3);
  const bloomAvg = bloomScores.reduce((s, v) => s + v, 0) / bloomScores.length;
  const bloomVariety = new Set(activities.map(a => a.bloom_level)).size;

  // Bloom progression: are higher blooms in later activities?
  let progressionScore = 5;
  if (activities.length >= 3) {
    const firstThird = bloomScores.slice(0, Math.ceil(bloomScores.length / 3));
    const lastThird = bloomScores.slice(-Math.ceil(bloomScores.length / 3));
    const firstAvg = firstThird.reduce((s, v) => s + v, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((s, v) => s + v, 0) / lastThird.length;
    progressionScore = lastAvg > firstAvg ? 8 : lastAvg === firstAvg ? 5 : 3;
  }

  // Categories used (thinking variety)
  const categories = new Set(activities.map(a => a.activity_category).filter(Boolean));
  const categoryVariety = Math.min(10, categories.size * 2);

  const score = (
    bloomAvg * 0.40 +
    (bloomVariety / 6) * 10 * 0.20 +
    progressionScore * 0.25 +
    categoryVariety * 0.15
  );

  const flags: string[] = [];
  if (bloomVariety < 3) flags.push("Low Bloom variety — add higher-order activities");
  if (bloomAvg < 4) flags.push("Activities cluster at lower Bloom levels");

  return {
    score: clamp(score, 0, 10),
    confidence: activities.length >= 6 ? 0.8 : 0.5,
    subScores: {
      bloomAvg: Math.round(bloomAvg * 10) / 10,
      bloomVariety,
      progression: progressionScore,
      categoryVariety,
    },
    flags,
  };
}

function scoreStudentAgency(activities: PolishedActivity[]): DimensionScore {
  if (activities.length === 0) {
    return { score: 0, confidence: 0, subScores: {}, flags: ["No activities to score"] };
  }

  // Grouping variety
  const groupings = new Set(activities.map(a => a.grouping).filter(Boolean));
  const groupingScore = Math.min(10, (groupings.size / GROUPING_VARIETY_TARGET) * 10);

  // Collaborative activities ratio
  const collabActivities = activities.filter(a =>
    a.grouping === "pair" || a.grouping === "small_group" || a.grouping === "whole_class"
  );
  const collabRatio = collabActivities.length / activities.length;
  const collabScore = collabRatio > 0.5 ? 8 : collabRatio > 0.25 ? 6 : collabRatio > 0 ? 4 : 2;

  // Response type variety (choice/agency proxy)
  const responseTypes = new Set(activities.map(a => a.response_type).filter(Boolean));
  const responseVariety = Math.min(10, responseTypes.size * 2);

  // Activities with scaffolding that allows choice
  const choiceActivities = activities.filter(a =>
    a.scaffolding?.hints && a.scaffolding.hints.length > 1
  );
  const choiceScore = Math.min(10, (choiceActivities.length / Math.max(1, activities.length)) * 15);

  const score = (
    groupingScore * 0.30 +
    collabScore * 0.30 +
    responseVariety * 0.20 +
    choiceScore * 0.20
  );

  const flags: string[] = [];
  if (groupings.size < 2) flags.push("Low grouping variety — add pair/group work");
  if (collabRatio < 0.2) flags.push("Few collaborative activities");

  return {
    score: clamp(score, 0, 10),
    confidence: activities.length >= 6 ? 0.8 : 0.5,
    subScores: { groupingVariety: groupings.size, collabRatio, responseVariety: responseTypes.size },
    flags,
  };
}

function scoreTeacherCraft(activities: PolishedActivity[]): DimensionScore {
  if (activities.length === 0) {
    return { score: 0, confidence: 0, subScores: {}, flags: ["No activities to score"] };
  }

  // UDL coverage
  const udlCheckpoints = new Set<string>();
  const udlPrinciples = new Set<string>();
  for (const act of activities) {
    for (const cp of act.udl_checkpoints || []) {
      udlCheckpoints.add(cp);
      const principle = mapUDLCheckpointToPrinciple(cp);
      if (principle) udlPrinciples.add(principle);
    }
  }
  const udlScore = udlPrinciples.size >= 3 ? 9 : udlPrinciples.size >= 2 ? 6 : udlPrinciples.size >= 1 ? 3 : 0;

  // Scaffolding presence
  const scaffoldedActivities = activities.filter(a => a.scaffolding &&
    ((a.scaffolding.hints && a.scaffolding.hints.length > 0) ||
     (a.scaffolding.sentence_starters && a.scaffolding.sentence_starters.length > 0))
  );
  const scaffoldingCoverage = scaffoldedActivities.length / activities.length;
  const scaffoldingScore = scaffoldingCoverage > 0.7 ? 9 : scaffoldingCoverage > 0.4 ? 6 : scaffoldingCoverage > 0 ? 3 : 0;

  // AI rules presence (indicates intentional AI integration)
  const aiRulesActivities = activities.filter(a => a.ai_rules && a.ai_rules.rules.length > 0);
  const aiScore = Math.min(10, (aiRulesActivities.length / Math.max(1, activities.length)) * 12);

  // Success criteria (look-fors)
  const lookForActivities = activities.filter(a => a.success_look_fors && a.success_look_fors.length > 0);
  const lookForScore = Math.min(10, (lookForActivities.length / Math.max(1, activities.length)) * 12);

  // Materials specified
  const materialsActivities = activities.filter(a => a.materials_needed && a.materials_needed.length > 0);
  const materialsScore = Math.min(10, (materialsActivities.length / Math.max(1, activities.length)) * 12);

  const score = (
    udlScore * 0.25 +
    scaffoldingScore * 0.25 +
    aiScore * 0.20 +
    lookForScore * 0.15 +
    materialsScore * 0.15
  );

  const flags: string[] = [];
  if (udlPrinciples.size < 2) flags.push("UDL coverage gap — add checkpoints across all 3 principles");
  if (scaffoldingCoverage < 0.4) flags.push("Many activities lack scaffolding");

  return {
    score: clamp(score, 0, 10),
    confidence: activities.length >= 6 ? 0.8 : 0.5,
    subScores: {
      udlCoverage: udlPrinciples.size,
      scaffoldingCoverage: Math.round(scaffoldingCoverage * 100),
      aiRulesCoverage: aiRulesActivities.length,
    },
    flags,
  };
}

function scoreVariety(activities: PolishedActivity[]): DimensionScore {
  if (activities.length === 0) {
    return { score: 0, confidence: 0, subScores: {}, flags: [] };
  }

  const blooms = new Set(activities.map(a => a.bloom_level).filter(Boolean));
  const groupings = new Set(activities.map(a => a.grouping).filter(Boolean));
  const categories = new Set(activities.map(a => a.activity_category).filter(Boolean));
  const phases = new Set(activities.map(a => a.phase).filter(Boolean));
  const responses = new Set(activities.map(a => a.response_type).filter(Boolean));

  const varietyScore = (
    Math.min(6, blooms.size) / 6 * 0.25 +
    Math.min(4, groupings.size) / 4 * 0.20 +
    Math.min(8, categories.size) / 8 * 0.25 +
    Math.min(5, phases.size) / 5 * 0.15 +
    Math.min(5, responses.size) / 5 * 0.15
  ) * 10;

  return {
    score: clamp(varietyScore, 0, 10),
    confidence: 0.8,
    subScores: {
      bloomTypes: blooms.size,
      groupingTypes: groupings.size,
      categoryTypes: categories.size,
      phaseTypes: phases.size,
      responseTypes: responses.size,
    },
    flags: varietyScore < 5 ? ["Limited variety across activity types"] : [],
  };
}

function scoreCoherence(
  timed: TimedUnit,
  activities: PolishedActivity[]
): DimensionScore {
  if (activities.length === 0) {
    return { score: 0, confidence: 0, subScores: {}, flags: [] };
  }

  let score = 5; // Base coherence score

  // Transitions present
  const withTransitions = activities.filter(a => a.transitionIn || a.transitionOut);
  const transitionCoverage = withTransitions.length / activities.length;
  score += transitionCoverage * 2;

  // Cross-references present
  const withCrossRefs = activities.filter(a => a.crossReferences && a.crossReferences.length > 0);
  score += Math.min(2, withCrossRefs.length * 0.5);

  // Library blocks (reuse = coherence with existing practice)
  const libraryBlocks = activities.filter(a => a.source === "library");
  score += Math.min(1, libraryBlocks.length * 0.3);

  return {
    score: clamp(score, 0, 10),
    confidence: 0.7,
    subScores: {
      transitionCoverage: Math.round(transitionCoverage * 100),
      crossReferences: withCrossRefs.length,
      libraryBlocksUsed: libraryBlocks.length,
    },
    flags: transitionCoverage < 0.5 ? ["Many activities lack transitions"] : [],
  };
}

// ─── Coverage Maps ───

function buildCoverage(activities: PolishedActivity[]) {
  const bloomDistribution: Record<string, number> = {};
  const groupingDistribution: Record<string, number> = {};
  const allUdl = new Set<string>();
  const phases = new Set<string>();
  const categories = new Set<string>();

  for (const act of activities) {
    bloomDistribution[act.bloom_level] = (bloomDistribution[act.bloom_level] || 0) + 1;
    groupingDistribution[act.grouping] = (groupingDistribution[act.grouping] || 0) + 1;
    if (act.phase) phases.add(act.phase);
    if (act.activity_category) categories.add(act.activity_category);
    for (const cp of act.udl_checkpoints || []) allUdl.add(cp);
  }

  // All possible UDL checkpoints (simplified set)
  const allPossibleUdl = [
    "1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1", "3.2", "3.3",
    "4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "6.1", "6.2", "6.3",
    "7.1", "7.2", "7.3", "8.1", "8.2", "8.3", "9.1", "9.2", "9.3",
  ];
  const udlMissing = allPossibleUdl.filter(cp => !allUdl.has(cp));

  return {
    bloomDistribution,
    groupingDistribution,
    udlCheckpointsCovered: Array.from(allUdl),
    udlCheckpointsMissing: udlMissing,
    phasesCovered: Array.from(phases),
    categoriesCovered: Array.from(categories),
  };
}

// ─── Main ───

export function stage6_scoreQuality(
  timed: TimedUnit,
  profile: FormatProfile,
  stageCosts?: Record<string, CostBreakdown>
): QualityReport {
  const allActivities = timed.lessons.flatMap(l => l.activities);

  // Score dimensions
  const cr = scoreCognitiveRigour(allActivities);
  const sa = scoreStudentAgency(allActivities);
  const tc = scoreTeacherCraft(allActivities);
  const variety = scoreVariety(allActivities);
  const coherence = scoreCoherence(timed, allActivities);

  // Overall with Pulse-style weighted average
  const weightedAvg = (
    cr.score * profile.pulseWeights.cognitiveRigour +
    sa.score * profile.pulseWeights.studentAgency +
    tc.score * profile.pulseWeights.teacherCraft
  ) * 0.7 + variety.score * 0.15 + coherence.score * 0.15;

  // Unevenness penalty (Bloomberg ESG style)
  const scores = [cr.score, sa.score, tc.score, variety.score, coherence.score];
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const stdDev = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length);
  const unevennessPenalty = stdDev > 2 ? (stdDev - 2) * 0.3 : 0;

  const overallScore = Math.round(Math.max(0, Math.min(10, weightedAvg - unevennessPenalty)) * 10) / 10;

  // Library metrics
  const libraryBlocks = allActivities.filter(a => a.source === "library");
  const generatedBlocks = allActivities.filter(a => a.source === "generated");
  const avgEfficacy = libraryBlocks.length > 0
    ? 50 // TODO: compute from actual block efficacy when available
    : 0;

  // Coverage
  const coverage = buildCoverage(allActivities);

  // Costs
  const perLessonCost: CostBreakdown[] = timed.lessons.map(() => ({ ...ZERO_COST }));
  const perStageCost: Record<string, CostBreakdown> = stageCosts || {};

  const totalInputTokens = Object.values(perStageCost).reduce((s, c) => s + c.inputTokens, 0);
  const totalOutputTokens = Object.values(perStageCost).reduce((s, c) => s + c.outputTokens, 0);
  const totalCostUSD = Object.values(perStageCost).reduce((s, c) => s + c.estimatedCostUSD, 0);
  const totalTimeMs = Object.values(perStageCost).reduce((s, c) => s + c.timeMs, 0);

  // Recommendations
  const recommendations: string[] = [];
  if (cr.score < 6) recommendations.push("Add activities at higher Bloom levels (Evaluate, Create) to improve cognitive rigour.");
  if (sa.score < 6) recommendations.push("Include more collaborative and student-choice activities for better agency.");
  if (tc.score < 6) recommendations.push("Add UDL checkpoints, scaffolding, and AI rules to improve teacher craft score.");
  if (variety.score < 5) recommendations.push("Diversify activity types — vary bloom levels, grouping, and response types.");
  if (coherence.score < 5) recommendations.push("Add transitions between activities and cross-references across lessons.");
  if (libraryBlocks.length === 0) recommendations.push("Build up your block library — reusing proven activities improves quality and saves time.");
  for (const flag of [...cr.flags, ...sa.flags, ...tc.flags]) {
    if (!recommendations.includes(flag)) recommendations.push(flag);
  }

  return {
    overallScore,
    dimensions: {
      cognitiveRigour: cr,
      studentAgency: sa,
      teacherCraft: tc,
      variety,
      coherence,
    },
    coverage,
    libraryMetrics: {
      blockReuseRate: allActivities.length > 0 ? libraryBlocks.length / allActivities.length : 0,
      avgBlockEfficacy: avgEfficacy,
      newBlocksGenerated: generatedBlocks.length,
    },
    costSummary: {
      totalCost: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        modelId: "mixed",
        estimatedCostUSD: totalCostUSD,
        timeMs: totalTimeMs,
      },
      perLessonCost,
      perStageCost,
    },
    recommendations,
  };
}

// ─── Util ───

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
