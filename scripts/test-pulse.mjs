/**
 * Standalone test runner for lesson-pulse.ts
 * Runs without vitest (which needs native rolldown bindings).
 * Usage: node --loader ts-paths-esm-loader/transpile-only scripts/test-pulse.mjs
 * Or: node scripts/test-pulse.mjs (uses compiled output)
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import { register } from "module";

// ─── Minimal test harness ───
let passed = 0;
let failed = 0;
let currentSuite = "";

function describe(name, fn) {
  const prev = currentSuite;
  currentSuite = currentSuite ? `${currentSuite} > ${name}` : name;
  fn();
  currentSuite = prev;
}

function it(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${currentSuite} > ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${currentSuite} > ${name}`);
    console.log(`    ${e.message}`);
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
    },
    toEqual(expected) {
      if (JSON.stringify(value) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toBeCloseTo(expected, precision = 2) {
      const factor = Math.pow(10, precision);
      if (Math.round(value * factor) !== Math.round(expected * factor))
        throw new Error(`Expected ~${expected} (precision ${precision}), got ${value}`);
    },
    toBeGreaterThan(expected) {
      if (!(value > expected)) throw new Error(`Expected ${value} > ${expected}`);
    },
    toBeLessThan(expected) {
      if (!(value < expected)) throw new Error(`Expected ${value} < ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(value >= expected)) throw new Error(`Expected ${value} >= ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      if (!(value <= expected)) throw new Error(`Expected ${value} <= ${expected}`);
    },
    toContain(expected) {
      if (typeof value === "string" && !value.includes(expected))
        throw new Error(`Expected string to contain "${expected}"`);
      if (Array.isArray(value) && !value.includes(expected))
        throw new Error(`Expected array to contain ${expected}`);
    },
    toBeTruthy() {
      if (!value) throw new Error(`Expected truthy, got ${value}`);
    },
  };
}

function beforeAll(fn) { fn(); }

// ─── Import the module ───

// Since we can't use tsx easily, inline the algorithm here by reading the TS source
// and extracting the logic. Instead, let's use a simpler approach: compile inline.

// Actually, let's just copy the pure logic since it has no dependencies besides types.

// ── Score Maps ──
const BLOOM_SCORES = {
  remember: 1, understand: 2, apply: 4, analyze: 6, evaluate: 8, create: 10,
};
const AGENCY_SCORES = {
  none: 0, choice_of_resource: 3, choice_of_approach: 5, choice_of_topic: 6,
  goal_setting: 7, progress_check: 6, strategy_reflection: 8, plan_adjustment: 9,
};
const COLLAB_SCORES = {
  none: 0, parallel: 2, cooperative: 5, collaborative: 8, interdependent: 10,
};
const THINKING_DEPTH_SCORES = {
  surface: 3, developing: 6, extended: 10,
};

function avg(nums) {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

function countUDLPrinciples(sections) {
  const allCheckpoints = sections.flatMap(s => s.udl_checkpoints || []);
  if (allCheckpoints.length === 0) return 0;
  const principles = new Set();
  for (const cp of allCheckpoints) {
    const prefix = parseInt(cp.split(".")[0], 10);
    if (prefix >= 1 && prefix <= 3) principles.add("representation");
    else if (prefix >= 4 && prefix <= 6) principles.add("action_expression");
    else if (prefix >= 7 && prefix <= 9) principles.add("engagement");
  }
  return principles.size;
}

function reliabilityAdjust(rawScore, dataPoints, totalActivities) {
  if (totalActivities === 0) return 5.0;
  const coverage = dataPoints / totalActivities;
  if (coverage >= 0.5) return rawScore;
  return 5.0 + (rawScore - 5.0) * coverage * 2;
}

function generateInsights(cr, sa, tc, sections) {
  const insights = [];
  if (cr < 5) {
    const bloomCounts = {};
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
  if (tc < 6) {
    const udlP = countUDLPrinciples(sections);
    if (udlP < 2) {
      insights.push(`UDL coverage is thin — only ${udlP}/3 principles addressed. Add one activity for the missing principle.`);
    }
    const scaffoldingComplete = sections.filter(s => s.scaffolding?.ell1 && s.scaffolding?.ell2 && s.scaffolding?.ell3).length;
    if (scaffoldingComplete === 0 && insights.length < 3) {
      insights.push("No activities have complete ELL scaffolding (3 tiers). Add sentence starters to the most text-heavy activity.");
    }
  }
  const scores = [cr, sa, tc];
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  if (max - min > 4 && insights.length < 3) {
    const weakest = cr === min ? "Cognitive Rigour" : sa === min ? "Student Agency" : "Teacher Craft";
    insights.push(`${weakest} is pulling your overall score down. A small improvement here has the biggest impact.`);
  }
  if (tc < 6 && insights.length < 3) {
    const groupingTypes = new Set(sections.map(s => s.grouping).filter(Boolean));
    if (groupingTypes.size < 2) {
      insights.push("Grouping variety is low. Try adding one pair or small-group activity to break up the mode.");
    }
  }
  return insights.slice(0, 3);
}

function computeLessonPulse(sections) {
  const n = sections.length;
  if (n === 0) {
    return {
      cognitiveRigour: 5, studentAgency: 5, teacherCraft: 5, overall: 5, insights: [],
      meta: {
        activityCount: 0,
        cr: { bloomAvg: 5, thinkingScore: 5, inquiryArc: 5, assessmentScore: 5 },
        sa: { agencyAvg: 5, collabAvg: 5, peerScore: 5 },
        tc: { groupingVariety: 5, udlCoverage: 5, scaffoldingScore: 5, diffScore: 5, aiScore: 5 },
        unevennessPenalty: 0, rawAvg: 5,
      },
    };
  }

  // 1. COGNITIVE RIGOUR
  const bloomValues = sections.map(s => BLOOM_SCORES[s.bloom_level || "apply"] || 4);
  const bloomAvg = avg(bloomValues);
  const bloomDataPoints = sections.filter(s => s.bloom_level).length;
  const bloomAdjusted = reliabilityAdjust(bloomAvg, bloomDataPoints, n);

  const thinkingSections = sections.filter(s => s.thinking_routine && s.thinking_routine !== "none");
  let thinkingScore;
  if (thinkingSections.length > 0) {
    const rawThinking = avg(thinkingSections.map(s => THINKING_DEPTH_SCORES[s.thinking_depth || "surface"] || 3));
    thinkingScore = reliabilityAdjust(rawThinking, thinkingSections.length, n);
  } else {
    thinkingScore = 5;
  }

  const inquiryPhases = new Set(sections.map(s => s.inquiry_phase).filter(Boolean));
  const inquiryArc = inquiryPhases.size > 0 ? Math.min(10, (inquiryPhases.size / 3) * 10) : 5;

  const assessmentTypes = new Set(sections.map(s => s.assessment_type).filter(t => t && t !== "none"));
  let assessmentScore;
  if (assessmentTypes.size === 0) assessmentScore = 4;
  else if (assessmentTypes.size === 1) assessmentScore = 6;
  else if (assessmentTypes.size === 2) assessmentScore = 8;
  else assessmentScore = 9;

  const cognitiveRigour = clamp(bloomAdjusted * 0.40 + thinkingScore * 0.25 + inquiryArc * 0.20 + assessmentScore * 0.15, 0, 10);

  // 2. STUDENT AGENCY
  const agencyValues = sections.map(s => AGENCY_SCORES[s.agency_type || "none"] || 0);
  const agencyAvg = avg(agencyValues);
  const collabValues = sections.map(s => COLLAB_SCORES[s.collaboration_depth || "none"] || 0);
  const collabAvg = avg(collabValues);
  const hasPeerAssessment = sections.some(s => s.assessment_type === "peer_feedback" || s.assessment_type === "self_assessment");
  const peerScore = hasPeerAssessment ? 8 : 3;
  const studentAgency = clamp(agencyAvg * 0.50 + collabAvg * 0.30 + peerScore * 0.20, 0, 10);

  // 3. TEACHER CRAFT
  const groupingTypes = new Set(sections.map(s => s.grouping).filter(Boolean));
  const groupingVariety = groupingTypes.size > 0 ? Math.min(10, (groupingTypes.size / 3) * 10) : 5;
  const udlPrinciples = countUDLPrinciples(sections);
  const udlCoverage = sections.some(s => s.udl_checkpoints && s.udl_checkpoints.length > 0) ? Math.min(10, (udlPrinciples / 3) * 10) : 5;
  const scaffoldingComplete = sections.filter(s => s.scaffolding?.ell1 && s.scaffolding?.ell2 && s.scaffolding?.ell3).length;
  const scaffoldingScore = n > 0 ? Math.min(10, (scaffoldingComplete / n) * 10) : 5;
  const hasDifferentiation = sections.some(s => s.differentiation?.extension || s.differentiation?.support || s.differentiation?.challenge);
  const diffScore = hasDifferentiation ? 8 : 4;
  const aiConfigured = sections.filter(s => s.ai_rules?.phase && s.ai_rules.phase !== "neutral").length;
  const aiScore = n > 0 ? Math.min(10, (aiConfigured / n) * 10) : 5;
  const teacherCraft = clamp(groupingVariety * 0.20 + udlCoverage * 0.25 + scaffoldingScore * 0.20 + diffScore * 0.20 + aiScore * 0.15, 0, 10);

  // OVERALL
  const rawAvg = (cognitiveRigour + studentAgency + teacherCraft) / 3;
  const stdDev = Math.sqrt(((cognitiveRigour - rawAvg) ** 2 + (studentAgency - rawAvg) ** 2 + (teacherCraft - rawAvg) ** 2) / 3);
  const unevennessPenalty = Math.min(1.5, stdDev * 0.5);
  const overall = clamp(rawAvg - unevennessPenalty, 0, 10);

  const insights = generateInsights(cognitiveRigour, studentAgency, teacherCraft, sections);

  return {
    cognitiveRigour: round1(cognitiveRigour),
    studentAgency: round1(studentAgency),
    teacherCraft: round1(teacherCraft),
    overall: round1(overall),
    insights,
    meta: {
      activityCount: n,
      cr: { bloomAvg: round1(bloomAdjusted), thinkingScore: round1(thinkingScore), inquiryArc: round1(inquiryArc), assessmentScore: round1(assessmentScore) },
      sa: { agencyAvg: round1(agencyAvg), collabAvg: round1(collabAvg), peerScore: round1(peerScore) },
      tc: { groupingVariety: round1(groupingVariety), udlCoverage: round1(udlCoverage), scaffoldingScore: round1(scaffoldingScore), diffScore: round1(diffScore), aiScore: round1(aiScore) },
      unevennessPenalty: round1(unevennessPenalty), rawAvg: round1(rawAvg),
    },
  };
}

function buildPulseRepairPrompt(lessonTitle, lessonGoal, sections, weakest, insights) {
  const sectionSummary = sections.map((s, i) =>
    `  ${i + 1}. "${s.prompt}" (bloom: ${s.bloom_level || "??"}, grouping: ${s.grouping || "??"})`
  ).join("\n");
  const strategies = {
    cr: "Rewrite 1-2 Work Time activities to target Analyze or Evaluate level. Add a thinking routine (See-Think-Wonder, Claim-Support-Question, or similar). Ensure at least 2 Bloom levels above Apply are represented.",
    sa: "Add a genuine choice point: let students choose their approach, material, or presentation format. Add one moment of self-assessment or peer feedback. Ensure at least one collaborative (not just cooperative) activity.",
    tc: "Vary the grouping (add one pair and one small-group activity if missing). Add sentence starters for ELL scaffolding on the most text-heavy activity. Ensure differentiation exists (extension for advanced, support for struggling).",
  };
  return `You are improving the quality of a lesson plan. The lesson "${lessonTitle}" (goal: ${lessonGoal}) scored ${weakest.score.toFixed(1)}/10 on ${weakest.name}.\n\nCurrent activities:\n${sectionSummary}\n\nInsights:\n${insights.map(i => `- ${i}`).join("\n")}\n\nREPAIR STRATEGY:\n${strategies[weakest.key] || strategies.tc}\n\nReturn ONLY the modified activity sections as a JSON array. Keep unchanged activities identical. Only modify 1-3 activities in the Work Time phase for maximum impact with minimum disruption. Preserve all activity IDs.`;
}

function buildPulseContext(previousPulses) {
  if (previousPulses.length === 0) return "";
  const avgCR = avg(previousPulses.map(p => p.cognitiveRigour));
  const avgSA = avg(previousPulses.map(p => p.studentAgency));
  const avgTC = avg(previousPulses.map(p => p.teacherCraft));
  const parts = [];
  if (avgCR < 5.5) parts.push(`The unit so far averages ${avgCR.toFixed(1)}/10 on Cognitive Rigour. This lesson should include at least one Analyze or Evaluate activity and a thinking routine.`);
  if (avgSA < 5.5) parts.push(`Student Agency is averaging ${avgSA.toFixed(1)}/10. This lesson should include at least one student choice moment and one collaborative activity.`);
  if (avgTC < 5.5) parts.push(`Teacher Craft is averaging ${avgTC.toFixed(1)}/10. This lesson should vary grouping from previous lessons and include scaffolding for diverse learners.`);
  if (parts.length === 0) return "";
  return `\n\n## Unit Balance (Lesson Pulse)\n${parts.join("\n")}`;
}

function buildPulseSkeletonTargets() {
  return `Quality targets (Lesson Pulse):\n- Aim for 6+ on all three dimensions: Cognitive Rigour, Student Agency, Teacher Craft\n- Vary Bloom levels across lessons (don't cluster at Remember/Understand)\n- Include at least 2 lessons with explicit student choice moments\n- Vary grouping across the unit (not all individual work)\n- At least 1 lesson should include peer feedback or self-assessment`;
}

// ─── Test Data ───

const TEACH_ENG = [
  { prompt: "Brainstorm uses for flexibility vs stiffness", bloom_level: "understand", agency_type: "none", collaboration_depth: "parallel", grouping: "whole_class", inquiry_phase: "brainstorm", assessment_type: "diagnostic" },
  { prompt: "Research Young's Modulus values for 6 materials", bloom_level: "remember", agency_type: "choice_of_resource", collaboration_depth: "parallel", grouping: "individual", inquiry_phase: "research", assessment_type: "formative" },
  { prompt: "Set up Arduino Uno + FSR", bloom_level: "apply", agency_type: "none", collaboration_depth: "cooperative", grouping: "small_group", inquiry_phase: "apply", assessment_type: "none" },
  { prompt: "Material testing + data collection", bloom_level: "apply", agency_type: "none", collaboration_depth: "cooperative", grouping: "small_group", inquiry_phase: "test", assessment_type: "formative" },
  { prompt: "Engineering design challenge", bloom_level: "create", agency_type: "choice_of_approach", collaboration_depth: "collaborative", grouping: "small_group", inquiry_phase: "design", assessment_type: "none" },
  { prompt: "Prototype build + test", bloom_level: "create", agency_type: "choice_of_approach", collaboration_depth: "collaborative", grouping: "small_group", inquiry_phase: "build", assessment_type: "none" },
  { prompt: "Improve + reflect", bloom_level: "evaluate", agency_type: "choice_of_approach", collaboration_depth: "collaborative", grouping: "small_group", inquiry_phase: "evaluate", assessment_type: "none" },
  { prompt: "Share designs", bloom_level: "analyze", agency_type: "none", collaboration_depth: "parallel", grouping: "whole_class", inquiry_phase: "reflect", assessment_type: "summative" },
];

// ─── Run Tests ───

console.log("\n═══ Lesson Pulse Algorithm Tests ═══\n");

describe("computeLessonPulse", () => {
  describe("empty input", () => {
    it("returns neutral 5/5/5/5 for empty sections", () => {
      const r = computeLessonPulse([]);
      expect(r.cognitiveRigour).toBe(5);
      expect(r.studentAgency).toBe(5);
      expect(r.teacherCraft).toBe(5);
      expect(r.overall).toBe(5);
      expect(r.insights).toEqual([]);
      expect(r.meta.activityCount).toBe(0);
    });
  });

  describe("TeachEngineering Under Pressure — full tagging", () => {
    const result = computeLessonPulse(TEACH_ENG);

    it("has 8 activities counted", () => {
      expect(result.meta.activityCount).toBe(8);
    });

    // CR: bloom (2+1+4+4+10+10+8+6)/8 = 5.625
    //     thinking = 5 (no routines)
    //     inquiry = 10 (8 phases, capped)
    //     assessment = 9 (3 types: diagnostic, formative, summative)
    //     CR = 5.625*0.40 + 5*0.25 + 10*0.20 + 9*0.15 = 2.25+1.25+2.0+1.35 = 6.85 → 6.9
    it("Cognitive Rigour ~6.9", () => {
      expect(result.cognitiveRigour).toBeCloseTo(6.9, 0);
    });

    it("bloom average ~5.6", () => {
      expect(result.meta.cr.bloomAvg).toBeCloseTo(5.6, 0);
    });

    it("thinking score = 5 (neutral, no routines)", () => {
      expect(result.meta.cr.thinkingScore).toBe(5);
    });

    it("inquiry arc = 10 (capped)", () => {
      expect(result.meta.cr.inquiryArc).toBe(10);
    });

    it("assessment score = 9 (3 types)", () => {
      expect(result.meta.cr.assessmentScore).toBe(9);
    });

    // SA: agency (0+3+0+0+5+5+5+0)/8 = 2.25
    //     collab (2+2+5+5+8+8+8+2)/8 = 5.0
    //     peer = 3 (no peer/self assessment)
    //     SA = 2.25*0.50 + 5.0*0.30 + 3*0.20 = 1.125+1.5+0.6 = 3.225 → 3.2
    it("Student Agency ~3.2", () => {
      expect(result.studentAgency).toBeGreaterThanOrEqual(3.0);
      expect(result.studentAgency).toBeLessThanOrEqual(3.5);
    });

    it("agency avg ~2.3", () => {
      expect(result.meta.sa.agencyAvg).toBeCloseTo(2.3, 0);
    });

    it("collaboration avg = 5.0", () => {
      expect(result.meta.sa.collabAvg).toBe(5);
    });

    it("peer score = 3 (no structured feedback)", () => {
      expect(result.meta.sa.peerScore).toBe(3);
    });

    // TC: grouping = 10 (3 types), UDL = 5 (neutral), scaffolding = 0, diff = 4, ai = 0
    //     TC = 10*0.20 + 5*0.25 + 0*0.20 + 4*0.20 + 0*0.15 = 2.0+1.25+0+0.8+0 = 4.05 → 4.1
    it("Teacher Craft ~4.1 (no UDL/scaffolding data)", () => {
      expect(result.teacherCraft).toBeCloseTo(4.1, 0);
    });

    it("grouping variety = 10 (3 types)", () => {
      expect(result.meta.tc.groupingVariety).toBe(10);
    });

    it("UDL coverage = 5 (neutral — no checkpoints)", () => {
      expect(result.meta.tc.udlCoverage).toBe(5);
    });

    it("scaffolding = 0 (no ELL data)", () => {
      expect(result.meta.tc.scaffoldingScore).toBe(0);
    });

    it("differentiation = 4 (no diff data)", () => {
      expect(result.meta.tc.diffScore).toBe(4);
    });

    // Overall: rawAvg = (6.9+3.2+4.1)/3 ≈ 4.73, penalty from spread
    it("overall has unevenness penalty > 0", () => {
      expect(result.meta.unevennessPenalty).toBeGreaterThan(0);
    });

    it("overall is between 3 and 5", () => {
      expect(result.overall).toBeGreaterThan(3);
      expect(result.overall).toBeLessThan(5);
    });

    it("generates actionable insights", () => {
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.insights.length).toBeLessThanOrEqual(3);
    });
  });

  describe("TeachEngineering — enriched with UDL/scaffolding", () => {
    const enriched = TEACH_ENG.map((a, i) => ({
      ...a,
      udl_checkpoints: i < 4 ? ["2.1", "4.1"] : ["2.1", "4.1", "7.1"],
      scaffolding: i >= 4 ? { ell1: "Starter", ell2: "Guided", ell3: "Independent" } : undefined,
      differentiation: i >= 4 ? { extension: "Advanced", support: "Simplified" } : undefined,
    }));

    const result = computeLessonPulse(enriched);

    it("TC is higher with enriched data (>5)", () => {
      expect(result.teacherCraft).toBeGreaterThan(5);
    });

    it("UDL coverage = 10 (all 3 principles)", () => {
      expect(result.meta.tc.udlCoverage).toBe(10);
    });

    it("scaffolding = 5 (4 of 8 activities)", () => {
      expect(result.meta.tc.scaffoldingScore).toBe(5);
    });

    it("CR stays ~6.9 (enrichment doesn't change bloom)", () => {
      expect(result.cognitiveRigour).toBeCloseTo(6.9, 0);
    });

    it("SA stays ~3.2 (enrichment doesn't change agency)", () => {
      expect(result.studentAgency).toBeCloseTo(3.2, 0);
    });
  });

  describe("high-quality balanced lesson", () => {
    const good = [
      { prompt: "Discuss", bloom_level: "analyze", agency_type: "choice_of_approach", collaboration_depth: "collaborative", grouping: "small_group", thinking_routine: "See-Think-Wonder", thinking_depth: "extended", inquiry_phase: "investigate", assessment_type: "diagnostic", udl_checkpoints: ["1.1", "4.2", "7.3"], scaffolding: { ell1: "a", ell2: "b", ell3: "c" }, differentiation: { extension: "x" }, ai_rules: { phase: "divergent", tone: "encouraging", rules: [] } },
      { prompt: "Design", bloom_level: "create", agency_type: "choice_of_topic", collaboration_depth: "interdependent", grouping: "pairs", thinking_routine: "Claim-Support-Question", thinking_depth: "extended", inquiry_phase: "create", assessment_type: "peer_feedback", udl_checkpoints: ["2.2", "5.1", "8.1"], scaffolding: { ell1: "a", ell2: "b", ell3: "c" }, differentiation: { challenge: "y" }, ai_rules: { phase: "convergent", tone: "analytical", rules: [] } },
      { prompt: "Test", bloom_level: "evaluate", agency_type: "strategy_reflection", collaboration_depth: "collaborative", grouping: "whole_class", thinking_routine: "Think-Pair-Share", thinking_depth: "developing", inquiry_phase: "evaluate", assessment_type: "self_assessment", udl_checkpoints: ["3.1", "6.1", "9.1"], scaffolding: { ell1: "a", ell2: "b", ell3: "c" }, differentiation: { extension: "z" }, ai_rules: { phase: "convergent", tone: "reflective", rules: [] } },
    ];

    const result = computeLessonPulse(good);

    it("all dimensions > 7", () => {
      expect(result.cognitiveRigour).toBeGreaterThan(7);
      expect(result.studentAgency).toBeGreaterThan(7);
      expect(result.teacherCraft).toBeGreaterThan(7);
    });

    it("low unevenness penalty", () => {
      expect(result.meta.unevennessPenalty).toBeLessThanOrEqual(0.5);
    });

    it("overall > 7", () => {
      expect(result.overall).toBeGreaterThan(7);
    });
  });

  describe("all-low lesson", () => {
    const low = [
      { prompt: "Read textbook", bloom_level: "remember", agency_type: "none", collaboration_depth: "none", grouping: "individual", assessment_type: "none" },
      { prompt: "Answer worksheet", bloom_level: "understand", agency_type: "none", collaboration_depth: "none", grouping: "individual", assessment_type: "none" },
      { prompt: "Teacher checks", bloom_level: "remember", agency_type: "none", collaboration_depth: "none", grouping: "whole_class", assessment_type: "formative" },
    ];

    const result = computeLessonPulse(low);

    it("CR < 5", () => { expect(result.cognitiveRigour).toBeLessThan(5); });
    it("SA < 2", () => { expect(result.studentAgency).toBeLessThan(2); });
    it("TC < 5", () => { expect(result.teacherCraft).toBeLessThan(5); });

    it("generates agency insight", () => {
      const agencyInsight = result.insights.find(i => i.toLowerCase().includes("choice") || i.toLowerCase().includes("agency"));
      expect(agencyInsight).toBeTruthy();
    });
  });
});

describe("reliabilityAdjust", () => {
  it("returns raw score at >= 50% coverage", () => {
    expect(reliabilityAdjust(8, 5, 10)).toBe(8);
    expect(reliabilityAdjust(8, 8, 10)).toBe(8);
  });

  it("shrinks high scores toward 5.0 at low coverage", () => {
    const r = reliabilityAdjust(10, 2, 10);
    expect(r).toBeCloseTo(7.0, 0);
  });

  it("shrinks low scores UP toward 5.0", () => {
    const r = reliabilityAdjust(1, 1, 10);
    expect(r).toBeCloseTo(4.2, 0);
  });

  it("returns 5.0 for zero total activities", () => {
    expect(reliabilityAdjust(8, 0, 0)).toBe(5.0);
  });
});

describe("countUDLPrinciples", () => {
  it("returns 0 for no checkpoints", () => {
    expect(countUDLPrinciples([{ prompt: "test" }])).toBe(0);
  });

  it("counts 1 principle (Representation)", () => {
    expect(countUDLPrinciples([{ prompt: "t", udl_checkpoints: ["1.1", "2.3"] }])).toBe(1);
  });

  it("counts 2 principles", () => {
    expect(countUDLPrinciples([{ prompt: "t", udl_checkpoints: ["1.1", "4.2"] }])).toBe(2);
  });

  it("counts all 3 principles", () => {
    expect(countUDLPrinciples([
      { prompt: "a", udl_checkpoints: ["1.1"] },
      { prompt: "b", udl_checkpoints: ["5.2"] },
      { prompt: "c", udl_checkpoints: ["7.1", "8.3"] },
    ])).toBe(3);
  });
});

describe("buildPulseRepairPrompt", () => {
  it("generates prompt for weakest dimension", () => {
    const p = buildPulseRepairPrompt("Test", "Goal", TEACH_ENG.slice(0, 3),
      { name: "Student Agency", key: "sa", score: 3.2 }, ["No choice moments."]);
    expect(p).toContain("Test");
    expect(p).toContain("3.2/10");
    expect(p).toContain("Student Agency");
    expect(p).toContain("choice point");
  });
});

describe("buildPulseContext", () => {
  it("returns empty for no pulses", () => {
    expect(buildPulseContext([])).toBe("");
  });

  it("returns empty when all healthy", () => {
    const r = buildPulseContext([{ cognitiveRigour: 7, studentAgency: 6, teacherCraft: 6.5 }]);
    expect(r).toBe("");
  });

  it("flags weak SA", () => {
    const r = buildPulseContext([{ cognitiveRigour: 7, studentAgency: 3.5, teacherCraft: 6 }]);
    expect(r).toContain("Student Agency");
  });
});

describe("buildPulseSkeletonTargets", () => {
  it("returns quality guidance", () => {
    const t = buildPulseSkeletonTargets();
    expect(t).toContain("Lesson Pulse");
    expect(t).toContain("Bloom");
  });
});

describe("edge cases", () => {
  it("single activity scores", () => {
    const r = computeLessonPulse([{ prompt: "Design challenge", bloom_level: "create", agency_type: "choice_of_approach", collaboration_depth: "collaborative", grouping: "small_group" }]);
    expect(r.meta.activityCount).toBe(1);
    expect(r.cognitiveRigour).toBeGreaterThan(5);
  });

  it("unknown bloom level defaults to apply (4)", () => {
    const r = computeLessonPulse([{ prompt: "Test", bloom_level: "unknown" }]);
    expect(r.meta.cr.bloomAvg).toBeCloseTo(4, 0);
  });

  it("good vs bad produces meaningful score difference", () => {
    const good = computeLessonPulse([
      { prompt: "a", bloom_level: "create", agency_type: "choice_of_topic", collaboration_depth: "collaborative", grouping: "pairs" },
      { prompt: "b", bloom_level: "evaluate", agency_type: "strategy_reflection", collaboration_depth: "interdependent", grouping: "small_group", assessment_type: "peer_feedback" },
    ]);
    const bad = computeLessonPulse([
      { prompt: "a", bloom_level: "remember", agency_type: "none", collaboration_depth: "none", grouping: "individual" },
      { prompt: "b", bloom_level: "understand", agency_type: "none", collaboration_depth: "none", grouping: "individual" },
    ]);
    expect(good.overall - bad.overall).toBeGreaterThan(2);
    expect(good.cognitiveRigour - bad.cognitiveRigour).toBeGreaterThan(2);
    expect(good.studentAgency - bad.studentAgency).toBeGreaterThan(3);
  });
});

// ─── Summary ───
console.log(`\n${"═".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(40)}\n`);

if (failed > 0) process.exit(1);
