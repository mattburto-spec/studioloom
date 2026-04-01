/**
 * Lesson Pulse — Composite Quality Scoring for Lessons
 *
 * Three dimensions:
 *   - Cognitive Rigour (bloom × thinking × inquiry × assessment)
 *   - Student Agency (agency × collaboration × peer assessment)
 *   - Teacher Craft (grouping × UDL × scaffolding × differentiation × AI rules)
 *
 * Inspired by AHRQ PSI 90 weighted composite + Bloomberg ESG unevenness penalty.
 * Reliability adjustment shrinks scores toward 5.0 when data is sparse.
 *
 * Spec: docs/specs/lesson-layer-architecture.md §13
 * Test run: docs/projects/lesson-pulse-test-run.md
 */

import type { ActivitySection, BloomLevel, GroupingStrategy } from "@/types";
import { getRepairMoves, formatRepairMoves, type PulseDimension as MovePulseDimension } from "@/lib/ai/teaching-moves";

// ─── Types ───

export interface LessonPulseScore {
  cognitiveRigour: number;   // 0-10
  studentAgency: number;     // 0-10
  teacherCraft: number;      // 0-10
  overall: number;           // 0-10 (weighted avg - unevenness penalty)
  insights: string[];        // 1-3 actionable nudges
  meta: PulseMeta;           // detailed breakdown for debugging/display
}

export interface PulseMeta {
  activityCount: number;
  cr: { bloomAvg: number; thinkingScore: number; inquiryArc: number; assessmentScore: number };
  sa: { agencyAvg: number; collabAvg: number; peerScore: number };
  tc: { groupingVariety: number; udlCoverage: number; scaffoldingScore: number; diffScore: number; aiScore: number };
  unevennessPenalty: number;
  rawAvg: number;
}

/**
 * Extended activity type for Pulse scoring.
 *
 * Uses existing ActivitySection fields plus optional future layer fields
 * that aren't yet in the canonical type. This lets the algorithm score
 * activities that have been manually tagged (e.g., in test data) or
 * will be tagged once Layer Registry Phase 3 ships.
 */
export interface PulseActivity extends ActivitySection {
  // Future layer fields — not yet in ActivitySection
  agency_type?: AgencyType;
  collaboration_depth?: CollaborationDepth;
  thinking_routine?: string;
  thinking_depth?: ThinkingDepth;
  inquiry_phase?: string;
  assessment_type?: AssessmentType;
}

export type AgencyType =
  | "none" | "choice_of_resource" | "choice_of_approach" | "choice_of_topic"
  | "goal_setting" | "progress_check" | "strategy_reflection" | "plan_adjustment";

export type CollaborationDepth =
  | "none" | "parallel" | "cooperative" | "collaborative" | "interdependent";

export type ThinkingDepth = "surface" | "developing" | "extended";

export type AssessmentType =
  | "none" | "diagnostic" | "formative" | "summative"
  | "peer_feedback" | "self_assessment";

// ─── Score Maps ───

const BLOOM_SCORES: Record<string, number> = {
  remember: 1, understand: 2, apply: 4, analyze: 6, evaluate: 8, create: 10,
};

const AGENCY_SCORES: Record<string, number> = {
  none: 0, choice_of_resource: 3, choice_of_approach: 5, choice_of_topic: 6,
  goal_setting: 7, progress_check: 6, strategy_reflection: 8, plan_adjustment: 9,
};

const COLLAB_SCORES: Record<string, number> = {
  none: 0, parallel: 2, cooperative: 5, collaborative: 8, interdependent: 10,
};

const THINKING_DEPTH_SCORES: Record<string, number> = {
  surface: 3, developing: 6, extended: 10,
};

// ─── Helpers ───

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Count how many of the 3 UDL principles are covered across all activities.
 * UDL checkpoint IDs: 1.x = Engagement, 2-5.x = Representation, 6-9.x = Action & Expression
 * Simplified: prefix 1-3 = Engagement, 4-6 = Representation, 7-9 = Action & Expression
 * Actual CAST mapping: 1-3 = Engagement, 4-6 = Representation (technically wrong)
 *
 * Actually the correct CAST mapping:
 *   Principle 1 (Engagement): checkpoints 7.x, 8.x, 9.x
 *   Principle 2 (Representation): checkpoints 1.x, 2.x, 3.x
 *   Principle 3 (Action & Expression): checkpoints 4.x, 5.x, 6.x
 *
 * We count principle coverage: how many of the 3 principles have at least 1 checkpoint?
 */
export function countUDLPrinciples(sections: PulseActivity[]): number {
  const allCheckpoints = sections.flatMap(s => s.udl_checkpoints || []);
  if (allCheckpoints.length === 0) return 0;

  const principles = new Set<string>();
  for (const cp of allCheckpoints) {
    const prefix = parseInt(cp.split(".")[0], 10);
    if (prefix >= 1 && prefix <= 3) principles.add("representation");
    else if (prefix >= 4 && prefix <= 6) principles.add("action_expression");
    else if (prefix >= 7 && prefix <= 9) principles.add("engagement");
  }
  return principles.size;
}

/**
 * Reliability adjustment — shrinks scores toward 5.0 when data is sparse.
 * Prevents a single "Create" bloom_level from inflating CR to 10.
 *
 * @param rawScore - The computed raw score (0-10)
 * @param dataPoints - How many activities had data for this sub-indicator
 * @param totalActivities - Total activity count
 * @returns Adjusted score
 */
export function reliabilityAdjust(rawScore: number, dataPoints: number, totalActivities: number): number {
  if (totalActivities === 0) return 5.0;
  const coverage = dataPoints / totalActivities;
  if (coverage >= 0.5) return rawScore; // enough data — trust it
  // Shrink toward 5.0 proportionally
  return 5.0 + (rawScore - 5.0) * coverage * 2;
}

// ─── Core Algorithm ───

/**
 * Compute Lesson Pulse from activity sections.
 *
 * Accepts PulseActivity[] (superset of ActivitySection[]) so it works with:
 * - Generated content (has bloom_level, grouping, ai_rules, udl_checkpoints)
 * - Manually tagged content (may have agency_type, collaboration_depth, etc.)
 * - Test data (fully annotated)
 *
 * Missing fields default to neutral scores (5.0) rather than penalizing.
 */
export function computeLessonPulse(sections: PulseActivity[]): LessonPulseScore {
  const n = sections.length;
  if (n === 0) {
    return {
      cognitiveRigour: 5, studentAgency: 5, teacherCraft: 5, overall: 5, insights: [],
      meta: {
        activityCount: 0,
        cr: { bloomAvg: 5, thinkingScore: 5, inquiryArc: 5, assessmentScore: 5 },
        sa: { agencyAvg: 5, collabAvg: 5, peerScore: 5 },
        tc: { groupingVariety: 5, udlCoverage: 5, scaffoldingScore: 5, diffScore: 5, aiScore: 5 },
        unevennessPenalty: 0,
        rawAvg: 5,
      },
    };
  }

  // ─── 1. COGNITIVE RIGOUR ───

  // Bloom's (40% weight)
  const bloomValues = sections.map(s => BLOOM_SCORES[s.bloom_level || "apply"] || 4);
  const bloomAvg = avg(bloomValues);
  const bloomDataPoints = sections.filter(s => s.bloom_level).length;
  const bloomAdjusted = reliabilityAdjust(bloomAvg, bloomDataPoints, n);

  // Thinking routines (25% weight)
  const thinkingSections = sections.filter(s => s.thinking_routine && s.thinking_routine !== "none");
  let thinkingScore: number;
  if (thinkingSections.length > 0) {
    const rawThinking = avg(
      thinkingSections.map(s => THINKING_DEPTH_SCORES[s.thinking_depth || "surface"] || 3)
    );
    thinkingScore = reliabilityAdjust(rawThinking, thinkingSections.length, n);
  } else {
    thinkingScore = 5; // neutral if no data
  }

  // Inquiry arc (20% weight) — how many distinct inquiry phases?
  const inquiryPhases = new Set(sections.map(s => s.inquiry_phase).filter(Boolean));
  const inquiryArc = inquiryPhases.size > 0
    ? Math.min(10, (inquiryPhases.size / 3) * 10) // 3+ phases = full marks
    : 5; // neutral if no data

  // Assessment (15% weight)
  const assessmentTypes = new Set(
    sections.map(s => s.assessment_type).filter(t => t && t !== "none")
  );
  let assessmentScore: number;
  if (assessmentTypes.size === 0) {
    assessmentScore = 4; // no assessment data → below neutral
  } else if (assessmentTypes.size === 1) {
    assessmentScore = 6;
  } else if (assessmentTypes.size === 2) {
    assessmentScore = 8;
  } else {
    assessmentScore = 9; // 3+ assessment types = excellent
  }

  const cognitiveRigour = clamp(
    bloomAdjusted * 0.40 + thinkingScore * 0.25 + inquiryArc * 0.20 + assessmentScore * 0.15,
    0, 10
  );

  // ─── 2. STUDENT AGENCY ───

  // Agency types (50% weight)
  const agencyValues = sections.map(s => AGENCY_SCORES[s.agency_type || "none"] || 0);
  const agencyDataPoints = sections.filter(s => s.agency_type && s.agency_type !== "none").length;
  const agencyAvg = avg(agencyValues);
  // Don't reliability-adjust agency — "none" is a real signal, not missing data

  // Collaboration depth (30% weight)
  const collabValues = sections.map(s => COLLAB_SCORES[s.collaboration_depth || "none"] || 0);
  const collabDataPoints = sections.filter(s => s.collaboration_depth && s.collaboration_depth !== "none").length;
  const collabAvg = avg(collabValues);

  // Peer/self assessment (20% weight)
  const hasPeerAssessment = sections.some(s =>
    s.assessment_type === "peer_feedback" || s.assessment_type === "self_assessment"
  );
  const peerScore = hasPeerAssessment ? 8 : 3;

  const studentAgency = clamp(agencyAvg * 0.50 + collabAvg * 0.30 + peerScore * 0.20, 0, 10);

  // ─── 3. TEACHER CRAFT ───

  // Grouping variety (20% weight)
  const groupingTypes = new Set(sections.map(s => s.grouping).filter(Boolean));
  const groupingVariety = groupingTypes.size > 0
    ? Math.min(10, (groupingTypes.size / 3) * 10)
    : 5; // neutral if no data

  // UDL coverage (25% weight)
  const udlPrinciples = countUDLPrinciples(sections);
  const udlCoverage = sections.some(s => s.udl_checkpoints && s.udl_checkpoints.length > 0)
    ? Math.min(10, (udlPrinciples / 3) * 10)
    : 5; // neutral if no UDL data at all

  // Scaffolding completeness (20% weight) — do activities have multi-tier scaffolding?
  const scaffoldingComplete = sections.filter(s =>
    s.scaffolding?.ell1 && s.scaffolding?.ell2 && s.scaffolding?.ell3
  ).length;
  const scaffoldingScore = n > 0 ? Math.min(10, (scaffoldingComplete / n) * 10) : 5;

  // Differentiation (20% weight)
  const hasDifferentiation = sections.some(s =>
    s.differentiation?.extension || s.differentiation?.support || s.differentiation?.challenge
  );
  const diffScore = hasDifferentiation ? 8 : 4;

  // AI rules configured (15% weight)
  const aiConfigured = sections.filter(s =>
    s.ai_rules?.phase && s.ai_rules.phase !== "neutral"
  ).length;
  const aiScore = n > 0 ? Math.min(10, (aiConfigured / n) * 10) : 5;

  const teacherCraft = clamp(
    groupingVariety * 0.20 + udlCoverage * 0.25 + scaffoldingScore * 0.20 +
    diffScore * 0.20 + aiScore * 0.15,
    0, 10
  );

  // ─── OVERALL: Bloomberg-style unevenness penalty ───

  const rawAvg = (cognitiveRigour + studentAgency + teacherCraft) / 3;
  const stdDev = Math.sqrt(
    ((cognitiveRigour - rawAvg) ** 2 + (studentAgency - rawAvg) ** 2 + (teacherCraft - rawAvg) ** 2) / 3
  );
  // Penalty: high stdDev (uneven scores) reduces overall
  // Max penalty: -1.5 points when stdDev is 3+ (e.g., scores of 9/2/7)
  const unevennessPenalty = Math.min(1.5, stdDev * 0.5);
  const overall = clamp(rawAvg - unevennessPenalty, 0, 10);

  // ─── INSIGHTS ───

  const insights = generateInsights(cognitiveRigour, studentAgency, teacherCraft, sections);

  return {
    cognitiveRigour: round1(cognitiveRigour),
    studentAgency: round1(studentAgency),
    teacherCraft: round1(teacherCraft),
    overall: round1(overall),
    insights,
    meta: {
      activityCount: n,
      cr: {
        bloomAvg: round1(bloomAdjusted),
        thinkingScore: round1(thinkingScore),
        inquiryArc: round1(inquiryArc),
        assessmentScore: round1(assessmentScore),
      },
      sa: {
        agencyAvg: round1(agencyAvg),
        collabAvg: round1(collabAvg),
        peerScore: round1(peerScore),
      },
      tc: {
        groupingVariety: round1(groupingVariety),
        udlCoverage: round1(udlCoverage),
        scaffoldingScore: round1(scaffoldingScore),
        diffScore: round1(diffScore),
        aiScore: round1(aiScore),
      },
      unevennessPenalty: round1(unevennessPenalty),
      rawAvg: round1(rawAvg),
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Insight Generation ───

function generateInsights(cr: number, sa: number, tc: number, sections: PulseActivity[]): string[] {
  const insights: string[] = [];

  // Low cognitive rigour
  if (cr < 5) {
    const bloomCounts: Record<string, number> = {};
    for (const s of sections) {
      const level = s.bloom_level || "apply";
      bloomCounts[level] = (bloomCounts[level] || 0) + 1;
    }
    const lowCount = (bloomCounts["remember"] || 0) + (bloomCounts["understand"] || 0);
    if (lowCount > sections.length * 0.6) {
      insights.push("Most activities sit at Remember/Understand. Try replacing one with an Analyze or Evaluate task.");
    } else {
      insights.push("Cognitive Rigour is below average. Add a thinking routine or push one activity to Analyze/Evaluate level.");
    }
  }

  // Zero or very low student agency
  if (sa < 3) {
    insights.push("Students have no choice points in this lesson. Add one 'choice of approach' moment in Work Time.");
  } else if (sa < 5) {
    const hasAnyChoice = sections.some(s => s.agency_type && s.agency_type !== "none");
    if (!hasAnyChoice) {
      insights.push("No student choice moments detected. Even one 'choose your approach' lifts agency significantly.");
    } else {
      insights.push("Student agency is weak — choice points exist but are limited. Add peer feedback or self-assessment.");
    }
  }

  // UDL gap
  if (tc < 6) {
    const udlPrinciples = countUDLPrinciples(sections);
    if (udlPrinciples < 2) {
      insights.push(`UDL coverage is thin — only ${udlPrinciples}/3 principles addressed. Add one activity for the missing principle.`);
    }

    // Scaffolding gap
    const scaffoldingComplete = sections.filter(s =>
      s.scaffolding?.ell1 && s.scaffolding?.ell2 && s.scaffolding?.ell3
    ).length;
    if (scaffoldingComplete === 0 && insights.length < 3) {
      insights.push("No activities have complete ELL scaffolding (3 tiers). Add sentence starters to the most text-heavy activity.");
    }
  }

  // Unevenness warning
  const scores = [cr, sa, tc];
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  if (max - min > 4 && insights.length < 3) {
    const weakest = cr === min ? "Cognitive Rigour" : sa === min ? "Student Agency" : "Teacher Craft";
    insights.push(`${weakest} is pulling your overall score down. A small improvement here has the biggest impact.`);
  }

  // Grouping variety
  if (tc < 6 && insights.length < 3) {
    const groupingTypes = new Set(sections.map(s => s.grouping).filter(Boolean));
    if (groupingTypes.size < 2) {
      insights.push("Grouping variety is low. Try adding one pair or small-group activity to break up the mode.");
    }
  }

  return insights.slice(0, 3); // max 3
}

// ─── Generation Co-Pilot Functions ───

/**
 * Build a repair prompt targeting the weakest Pulse dimension.
 * Used by generate-unit/route.ts after scoring.
 */
export function buildPulseRepairPrompt(
  lessonTitle: string,
  lessonGoal: string,
  sections: PulseActivity[],
  weakest: { name: string; key: string; score: number },
  insights: string[],
): string {
  const sectionSummary = sections.map((s, i) =>
    `  ${i + 1}. "${s.prompt}" (bloom: ${s.bloom_level || "??"}, grouping: ${s.grouping || "??"})`
  ).join("\n");

  const strategies: Record<string, string> = {
    cr: "Rewrite 1-2 Work Time activities to target Analyze or Evaluate level. Add a thinking routine (See-Think-Wonder, Claim-Support-Question, or similar). Ensure at least 2 Bloom levels above Apply are represented.",
    sa: "Add a genuine choice point: let students choose their approach, material, or presentation format. Add one moment of self-assessment or peer feedback. Ensure at least one collaborative (not just cooperative) activity.",
    tc: "Vary the grouping (add one pair and one small-group activity if missing). Add sentence starters for ELL scaffolding on the most text-heavy activity. Ensure differentiation exists (extension for advanced, support for struggling).",
  };

  // Retrieve teaching moves that specifically boost the weak dimension
  let movesSection = "";
  try {
    const dimMap: Record<string, MovePulseDimension> = {
      cr: "cognitive_rigour",
      sa: "student_agency",
      tc: "teacher_craft",
    };
    const targetDim = dimMap[weakest.key] || "teacher_craft";
    const repairMovesList = getRepairMoves(targetDim);
    if (repairMovesList.length > 0) {
      movesSection = "\n\nPROVEN TEACHING MOVES TO CONSIDER:\n" + formatRepairMoves(targetDim, repairMovesList);
    }
  } catch {
    // Teaching moves are enhancement, not requirement
  }

  return `You are improving the quality of a lesson plan. The lesson "${lessonTitle}" (goal: ${lessonGoal}) scored ${weakest.score.toFixed(1)}/10 on ${weakest.name}.

Current activities:
${sectionSummary}

Insights:
${insights.map(i => `- ${i}`).join("\n")}

REPAIR STRATEGY:
${strategies[weakest.key] || strategies.tc}${movesSection}

Return ONLY the modified activity sections as a JSON array. Keep unchanged activities identical. Only modify 1-3 activities in the Work Time phase for maximum impact with minimum disruption. Preserve all activity IDs.`;
}

/**
 * Build cross-lesson balancing context for injection into generation prompts.
 * Only injects guidance when a dimension trends weak across the unit so far.
 */
export function buildPulseContext(previousPulses: LessonPulseScore[]): string {
  if (previousPulses.length === 0) return "";

  const avgCR = avg(previousPulses.map(p => p.cognitiveRigour));
  const avgSA = avg(previousPulses.map(p => p.studentAgency));
  const avgTC = avg(previousPulses.map(p => p.teacherCraft));

  const parts: string[] = [];

  if (avgCR < 5.5) {
    let crMoves = "";
    try {
      const moves = getRepairMoves("cognitive_rigour", undefined, 2);
      if (moves.length > 0) crMoves = ` Try: ${moves.map(m => `"${m.name}"`).join(" or ")}.`;
    } catch { /* enhancement only */ }
    parts.push(
      `The unit so far averages ${avgCR.toFixed(1)}/10 on Cognitive Rigour. ` +
      `This lesson should include at least one Analyze or Evaluate activity and a thinking routine.${crMoves}`
    );
  }
  if (avgSA < 5.5) {
    let saMoves = "";
    try {
      const moves = getRepairMoves("student_agency", undefined, 2);
      if (moves.length > 0) saMoves = ` Try: ${moves.map(m => `"${m.name}"`).join(" or ")}.`;
    } catch { /* enhancement only */ }
    parts.push(
      `Student Agency is averaging ${avgSA.toFixed(1)}/10. ` +
      `This lesson should include at least one student choice moment and one collaborative activity.${saMoves}`
    );
  }
  if (avgTC < 5.5) {
    let tcMoves = "";
    try {
      const moves = getRepairMoves("teacher_craft", undefined, 2);
      if (moves.length > 0) tcMoves = ` Try: ${moves.map(m => `"${m.name}"`).join(" or ")}.`;
    } catch { /* enhancement only */ }
    parts.push(
      `Teacher Craft is averaging ${avgTC.toFixed(1)}/10. ` +
      `This lesson should vary grouping from previous lessons and include scaffolding for diverse learners.${tcMoves}`
    );
  }

  if (parts.length === 0) return ""; // all dimensions healthy — don't over-constrain

  return `\n\n## Unit Balance (Lesson Pulse)\n${parts.join("\n")}`;
}

/**
 * Build Pulse quality targets for skeleton generation prompts.
 */
export function buildPulseSkeletonTargets(): string {
  return `Quality targets (Lesson Pulse):
- Aim for 6+ on all three dimensions: Cognitive Rigour, Student Agency, Teacher Craft
- Vary Bloom levels across lessons (don't cluster at Remember/Understand)
- Include at least 2 lessons with explicit student choice moments
- Vary grouping across the unit (not all individual work)
- At least 1 lesson should include peer feedback or self-assessment`;
}
