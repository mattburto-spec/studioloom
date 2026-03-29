/**
 * Timing Validation Engine
 *
 * Validates AI-generated lessons against the Workshop Model and auto-repairs timing issues.
 * Run this on every generated lesson before saving to database.
 *
 * Workshop Model rules:
 * 1. Every lesson has 4 phases: Opening, Mini-Lesson, Work Time, Debrief
 * 2. Direct instruction <= (1 + avg student age) minutes
 * 3. Work Time >= 45% of usable time
 * 4. Debrief >= 5 minutes (non-negotiable)
 * 5. Section durations sum to usable time (not raw period)
 * 6. No passive phase > 20 min (Y7-9) or > 30 min (Y10+)
 * 7. Extensions present (2-3 per lesson, phase-indexed)
 */

import type { GradeTimingProfile } from "./prompts";
import { maxInstructionMinutes, MIN_WORK_TIME_PERCENT, calculateUsableTime, type TimingContext } from "./prompts";

// =========================================================================
// Types
// =========================================================================

export interface WorkshopPhases {
  opening: { durationMinutes: number; hook?: string };
  miniLesson: { durationMinutes: number; focus?: string };
  workTime: { durationMinutes: number; focus?: string; checkpoints?: string[] };
  debrief: { durationMinutes: number; protocol?: string; prompt?: string };
}

export interface LessonExtension {
  title: string;
  description: string;
  durationMinutes: number;
  designPhase?: "investigation" | "ideation" | "prototyping" | "evaluation";
}

export interface LessonSection {
  prompt?: string;
  durationMinutes: number;
  criterionTags?: string[];
  responseType?: string;
  [key: string]: unknown;
}

export interface GeneratedLesson {
  title: string;
  learningGoal?: string;
  workshopPhases?: WorkshopPhases;
  sections?: LessonSection[];
  reflection?: { type?: string; items?: string[] };
  extensions?: LessonExtension[];
  vocabWarmup?: unknown;
  introduction?: { text?: string };
  [key: string]: unknown;
}

export type TimingIssueSeverity = "error" | "warning" | "info";

export interface TimingIssue {
  code: string;
  severity: TimingIssueSeverity;
  message: string;
  phase?: string;
  autoFixed?: boolean;
}

export interface TimingValidationResult {
  valid: boolean;
  issues: TimingIssue[];
  /** The lesson after auto-repair (mutated copy) */
  repairedLesson: GeneratedLesson;
  /** Summary stats */
  stats: {
    totalSectionMinutes: number;
    usableMinutes: number;
    workTimeMinutes: number;
    workTimePercent: number;
    instructionMinutes: number;
    instructionCap: number;
    hasDebrief: boolean;
    extensionCount: number;
  };
}

// =========================================================================
// Debrief protocol templates (used for auto-repair)
// =========================================================================

const DEBRIEF_PROTOCOLS: Record<string, { protocol: string; prompt: string }> = {
  "quick-share": {
    protocol: "quick-share",
    prompt: "Quick share: 2-3 students share one thing they worked on today (1 min each). Teacher synthesises: 'I noticed...'. Bridge to next lesson.",
  },
  "i-like-i-wish": {
    protocol: "i-like-i-wish",
    prompt: "Pair up. Each person gets 2 minutes: share your work, then partner gives 'I like...' (what works) and 'I wish...' (what could improve) feedback.",
  },
  "exit-ticket": {
    protocol: "exit-ticket",
    prompt: "Exit ticket: Write (1) one thing you learned today, and (2) one question you still have. Hand in before leaving.",
  },
  "two-stars-a-wish": {
    protocol: "two-stars-a-wish",
    prompt: "Two Stars & a Wish: Look at your work today. Write two things you're proud of (stars) and one thing you want to improve next time (wish).",
  },
};

// =========================================================================
// Validation Logic
// =========================================================================

/**
 * Validate a generated lesson against the Workshop Model rules.
 * Returns issues found + an auto-repaired copy of the lesson.
 */
export function validateLessonTiming(
  lesson: GeneratedLesson,
  profile: GradeTimingProfile,
  timingCtx: TimingContext
): TimingValidationResult {
  const issues: TimingIssue[] = [];
  // Deep clone for repair
  const repaired: GeneratedLesson = JSON.parse(JSON.stringify(lesson));

  const usable = calculateUsableTime(timingCtx);
  const instructionCap = maxInstructionMinutes(profile);

  // ---- 1. Workshop phases present? ----
  if (!repaired.workshopPhases) {
    issues.push({
      code: "MISSING_WORKSHOP_PHASES",
      severity: "warning",
      message: "Lesson has no workshopPhases. Auto-generating from sections.",
      autoFixed: true,
    });
    repaired.workshopPhases = inferWorkshopPhases(repaired, usable, instructionCap);
  }

  const phases = repaired.workshopPhases!;

  // ---- 2. Instruction cap (1 + age) ----
  if (phases.miniLesson.durationMinutes > instructionCap) {
    issues.push({
      code: "INSTRUCTION_OVER_CAP",
      severity: "warning",
      message: `Mini-Lesson is ${phases.miniLesson.durationMinutes} min but cap is ${instructionCap} min (1 + age ${profile.avgStudentAge}). Clamping.`,
      phase: "miniLesson",
      autoFixed: true,
    });
    const excess = phases.miniLesson.durationMinutes - instructionCap;
    phases.miniLesson.durationMinutes = instructionCap;
    // Give excess to work time
    phases.workTime.durationMinutes += excess;
  }

  // ---- 3. Work time floor (45%) ----
  const totalPhaseMinutes = phases.opening.durationMinutes + phases.miniLesson.durationMinutes + phases.workTime.durationMinutes + phases.debrief.durationMinutes;
  const workPercent = phases.workTime.durationMinutes / usable;

  if (workPercent < MIN_WORK_TIME_PERCENT) {
    const minWork = Math.round(usable * MIN_WORK_TIME_PERCENT);
    issues.push({
      code: "WORK_TIME_TOO_SHORT",
      severity: "error",
      message: `Work Time is ${phases.workTime.durationMinutes} min (${Math.round(workPercent * 100)}%) but minimum is ${minWork} min (45%). Redistributing time.`,
      phase: "workTime",
      autoFixed: true,
    });
    // Compress mini-lesson and opening to make room
    const deficit = minWork - phases.workTime.durationMinutes;
    const compressible = phases.miniLesson.durationMinutes - 5 + Math.max(0, phases.opening.durationMinutes - 5);
    if (compressible >= deficit) {
      // Take from mini-lesson first, then opening
      const fromMiniLesson = Math.min(deficit, phases.miniLesson.durationMinutes - 5);
      phases.miniLesson.durationMinutes -= fromMiniLesson;
      const remaining = deficit - fromMiniLesson;
      if (remaining > 0) {
        phases.opening.durationMinutes -= remaining;
      }
    } else {
      // Do our best
      phases.miniLesson.durationMinutes = 5;
      phases.opening.durationMinutes = 5;
    }
    phases.workTime.durationMinutes = usable - phases.opening.durationMinutes - phases.miniLesson.durationMinutes - phases.debrief.durationMinutes;
  }

  // ---- 4. Debrief present and >= 5 min ----
  if (!phases.debrief || phases.debrief.durationMinutes < 5) {
    issues.push({
      code: "DEBRIEF_TOO_SHORT",
      severity: "warning",
      message: `Debrief is ${phases.debrief?.durationMinutes ?? 0} min. Setting to 5 min minimum.`,
      phase: "debrief",
      autoFixed: true,
    });
    const debriefNeeded = 5 - (phases.debrief?.durationMinutes ?? 0);
    phases.debrief = {
      ...(phases.debrief || {}),
      durationMinutes: 5,
      ...DEBRIEF_PROTOCOLS["quick-share"],
    };
    // Take time from work time if needed
    if (phases.workTime.durationMinutes > debriefNeeded + 15) {
      phases.workTime.durationMinutes -= debriefNeeded;
    }
  }

  // Ensure debrief has a protocol
  if (!phases.debrief.protocol) {
    phases.debrief = { ...phases.debrief, ...DEBRIEF_PROTOCOLS["quick-share"] };
    issues.push({
      code: "DEBRIEF_NO_PROTOCOL",
      severity: "info",
      message: "Debrief had no structured protocol. Added 'quick-share' protocol.",
      phase: "debrief",
      autoFixed: true,
    });
  }

  // ---- 5. Total time matches usable ----
  const repairedTotal = phases.opening.durationMinutes + phases.miniLesson.durationMinutes + phases.workTime.durationMinutes + phases.debrief.durationMinutes;
  if (Math.abs(repairedTotal - usable) > 2) {
    issues.push({
      code: "TOTAL_TIME_MISMATCH",
      severity: "warning",
      message: `Phase durations sum to ${repairedTotal} min but usable time is ${usable} min. Adjusting work time.`,
      autoFixed: true,
    });
    // Adjust work time to absorb the difference
    phases.workTime.durationMinutes += (usable - repairedTotal);
  }

  // ---- 6. Cognitive load: no passive phase > max ----
  const maxPassive = profile.mypYear <= 3 ? 20 : 30;
  if (repaired.sections) {
    for (const section of repaired.sections) {
      if (section.durationMinutes > maxPassive && !isHandsOnSection(section)) {
        issues.push({
          code: "PASSIVE_PHASE_TOO_LONG",
          severity: "warning",
          message: `Section "${section.prompt?.slice(0, 50)}..." is ${section.durationMinutes} min (max passive: ${maxPassive} min for Year ${profile.mypYear}). Consider splitting.`,
        });
      }
    }
  }

  // ---- 7. Extensions present ----
  const extensionCount = repaired.extensions?.length ?? 0;
  if (extensionCount < 2) {
    issues.push({
      code: "INSUFFICIENT_EXTENSIONS",
      severity: "info",
      message: `Lesson has ${extensionCount} extensions (need 2-3). Teachers need early-finisher activities.`,
    });
  }

  // ---- 8. Check-in points for long work blocks ----
  if (phases.workTime.durationMinutes >= 30 && (!phases.workTime.checkpoints || phases.workTime.checkpoints.length === 0)) {
    issues.push({
      code: "MISSING_CHECKPOINTS",
      severity: "info",
      message: `Work Time is ${phases.workTime.durationMinutes} min with no checkpoints. Adding a midpoint check-in.`,
      phase: "workTime",
      autoFixed: true,
    });
    phases.workTime.checkpoints = [`At ${Math.round(phases.workTime.durationMinutes / 2)} min: "Where are you up to? What's your next step?"`];
  }

  // ---- 9. UDL coverage gap check (Dimensions v2) ----
  // Check if the lesson addresses all 3 UDL principles across its activities
  const udlPrinciples = { engagement: false, representation: false, action_expression: false };
  const sections = repaired.sections || [];
  for (const section of sections) {
    const udl = (section as Record<string, unknown>).udl_checkpoints;
    if (Array.isArray(udl)) {
      for (const cp of udl) {
        const num = typeof cp === "string" ? parseFloat(cp) : NaN;
        if (!isNaN(num)) {
          if (num >= 1 && num <= 3.9) udlPrinciples.engagement = true;
          if (num >= 4 && num <= 6.9) udlPrinciples.representation = true;
          if (num >= 7 && num <= 9.9) udlPrinciples.action_expression = true;
        }
      }
    }
  }
  const missingUdl = Object.entries(udlPrinciples)
    .filter(([, v]) => !v)
    .map(([k]) => k.replace(/_/g, " "));
  if (missingUdl.length > 0 && sections.some((s) => Array.isArray((s as Record<string, unknown>).udl_checkpoints))) {
    // Only report if at least one section HAS UDL tags (otherwise lesson predates Dimensions v2)
    issues.push({
      code: "UDL_COVERAGE_GAP",
      severity: "info",
      message: `UDL gap: no activities address ${missingUdl.join(", ")}. Consider adding activities for ${missingUdl.map((p) => p === "engagement" ? "recruiting interest/self-regulation" : p === "representation" ? "multiple media/language support" : "flexible expression/executive function").join(", ")}.`,
    });
  }

  // Compute final stats
  const finalWorkPercent = phases.workTime.durationMinutes / usable;
  const sectionTotal = (repaired.sections || []).reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    repairedLesson: repaired,
    stats: {
      totalSectionMinutes: sectionTotal,
      usableMinutes: usable,
      workTimeMinutes: phases.workTime.durationMinutes,
      workTimePercent: Math.round(finalWorkPercent * 100),
      instructionMinutes: phases.miniLesson.durationMinutes,
      instructionCap,
      hasDebrief: phases.debrief.durationMinutes >= 5,
      extensionCount,
    },
  };
}

/**
 * Validate all lessons in a unit at once. Returns per-lesson results + unit-wide issues.
 */
export function validateUnitTiming(
  lessons: Record<string, GeneratedLesson>,
  profile: GradeTimingProfile,
  timingCtx: TimingContext
): {
  lessonResults: Record<string, TimingValidationResult>;
  unitIssues: TimingIssue[];
} {
  const lessonResults: Record<string, TimingValidationResult> = {};
  const unitIssues: TimingIssue[] = [];

  for (const [id, lesson] of Object.entries(lessons)) {
    lessonResults[id] = validateLessonTiming(lesson, profile, timingCtx);
  }

  // Unit-wide checks
  const lessonCount = Object.keys(lessons).length;
  const totalExtensions = Object.values(lessonResults).reduce((sum, r) => sum + r.stats.extensionCount, 0);
  const avgWorkPercent = Object.values(lessonResults).reduce((sum, r) => sum + r.stats.workTimePercent, 0) / lessonCount;

  if (avgWorkPercent < 45) {
    unitIssues.push({
      code: "UNIT_WORK_TIME_LOW",
      severity: "warning",
      message: `Average Work Time across unit is ${Math.round(avgWorkPercent)}% (should be ≥45%).`,
    });
  }

  if (totalExtensions < lessonCount * 2) {
    unitIssues.push({
      code: "UNIT_EXTENSIONS_LOW",
      severity: "info",
      message: `Unit has ${totalExtensions} extensions across ${lessonCount} lessons (target: ${lessonCount * 2}-${lessonCount * 3}).`,
    });
  }

  // ---- 66% Active Content Rule (research-backed) ----
  // Achievement gaps only close when >66% of class time is active learning.
  // Source: docs/research/student-influence-factors.md — active engagement d=0.52
  const { activeCount, passiveCount, activePercent } = classifyUnitActivityBalance(lessons);
  if (activePercent < 66) {
    unitIssues.push({
      code: "UNIT_ACTIVE_CONTENT_LOW",
      severity: "warning",
      message: `Only ${activePercent}% of activities are active learning (${activeCount} active, ${passiveCount} passive). Research shows achievement gaps close only when >66% of class time is active. Consider replacing passive content sections with hands-on, discussion, or creation activities.`,
    });
  }

  return { lessonResults, unitIssues };
}

/**
 * Classify a section/activity as "active" or "passive" learning.
 *
 * Active: student is creating, discussing, analyzing, designing, collaborating,
 *         building, sketching, prototyping, evaluating, presenting, or using tools.
 * Passive: reading content, watching demonstrations, listening to instruction,
 *          content-only blocks with no student response required.
 *
 * Research basis: Active engagement effect size d=0.52 (Hattie/Visible Learning).
 * Achievement gaps close only when >66% of class time is active learning.
 */
function isActiveSection(section: LessonSection): boolean {
  // Response types that require student action are always active
  const activeResponseTypes = [
    "text", "upload", "voice", "canvas", "multi",
    "decision-matrix", "pmi", "pairwise", "trade-off-sliders",
  ];
  if (section.responseType && activeResponseTypes.includes(section.responseType)) {
    return true;
  }

  // Check prompt text for active learning verbs
  const prompt = (section.prompt || "").toLowerCase();
  const activeVerbs = /\b(create|design|build|sketch|prototype|make|construct|write|discuss|debate|compare|analyze|evaluate|test|experiment|present|share|collaborate|brainstorm|investigate|research|interview|survey|reflect|plan|justify|explain|argue|demonstrate|model|role.?play|peer.?review|critique|annotate|map|diagram|sort|rank|categorise|categorize|assess|measure|document|photograph|record|film|draw|paint|sculpt|assemble|code|program|iterate|refine|improve)\b/;
  if (activeVerbs.test(prompt)) return true;

  // If it has criterion tags, it likely requires active work
  if (section.criterionTags && section.criterionTags.length > 0) return true;

  // Default: passive (content delivery, reading, intro text)
  return false;
}

/**
 * Calculate the active vs passive learning balance across all lessons in a unit.
 * Returns counts and percentage.
 */
function classifyUnitActivityBalance(
  lessons: Record<string, GeneratedLesson>
): { activeCount: number; passiveCount: number; activePercent: number } {
  let activeCount = 0;
  let passiveCount = 0;

  for (const lesson of Object.values(lessons)) {
    if (!lesson.sections) continue;
    for (const section of lesson.sections) {
      if (isActiveSection(section)) {
        activeCount++;
      } else {
        passiveCount++;
      }
    }
  }

  const total = activeCount + passiveCount;
  const activePercent = total > 0 ? Math.round((activeCount / total) * 100) : 100;

  return { activeCount, passiveCount, activePercent };
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Infer workshop phases from a lesson that was generated without them.
 * Uses heuristics to map existing sections to the workshop model.
 */
function inferWorkshopPhases(lesson: GeneratedLesson, usableMinutes: number, instructionCap: number): WorkshopPhases {
  const sections = lesson.sections || [];
  const sectionTotal = sections.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  // Calculate phase durations from proportions
  const openingMin = Math.min(10, Math.round(usableMinutes * 0.08));
  const debriefMin = Math.min(10, Math.max(5, Math.round(usableMinutes * 0.08)));
  const miniLessonMin = Math.min(instructionCap, Math.round(usableMinutes * 0.18));
  const workTimeMin = usableMinutes - openingMin - miniLessonMin - debriefMin;

  return {
    opening: {
      durationMinutes: Math.max(5, openingMin),
      hook: lesson.introduction?.text?.slice(0, 100) || "Connect to prior learning and set the stage",
    },
    miniLesson: {
      durationMinutes: miniLessonMin,
      focus: lesson.learningGoal || "Key skill for today's session",
    },
    workTime: {
      durationMinutes: Math.max(15, workTimeMin),
      focus: sections[0]?.prompt?.slice(0, 100) || "Student creation and practice time",
      checkpoints: workTimeMin >= 30 ? [`At ${Math.round(workTimeMin / 2)} min: Check progress and redirect`] : [],
    },
    debrief: {
      durationMinutes: Math.max(5, debriefMin),
      ...DEBRIEF_PROTOCOLS["quick-share"],
    },
  };
}

/**
 * Heuristic check if a section is hands-on (longer attention spans tolerated).
 */
function isHandsOnSection(section: LessonSection): boolean {
  const handsonTypes = ["upload", "canvas", "decision-matrix", "trade-off-sliders"];
  if (section.responseType && handsonTypes.includes(section.responseType)) return true;
  const prompt = (section.prompt || "").toLowerCase();
  return /\b(build|create|sketch|prototype|make|construct|assemble|test|experiment)\b/.test(prompt);
}

// =========================================================================
// Workshop Phase Presets
// =========================================================================

export interface TimingPreset {
  id: string;
  name: string;
  description: string;
  /** Factory function: given usable time and instruction cap, returns phase durations */
  getPhases: (usableMinutes: number, instructionCap: number) => WorkshopPhases;
}

export const TIMING_PRESETS: TimingPreset[] = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Standard workshop flow — good for most lessons",
    getPhases: (usable, cap) => {
      const opening = Math.min(7, Math.round(usable * 0.1));
      const miniLesson = Math.min(cap, Math.round(usable * 0.2));
      const debrief = Math.min(8, Math.max(5, Math.round(usable * 0.08)));
      return {
        opening: { durationMinutes: opening },
        miniLesson: { durationMinutes: miniLesson },
        workTime: { durationMinutes: usable - opening - miniLesson - debrief },
        debrief: { durationMinutes: debrief },
      };
    },
  },
  {
    id: "hands-on-heavy",
    name: "Hands-On Heavy",
    description: "Maximise making time — best for prototyping & building sessions",
    getPhases: (usable, cap) => {
      const opening = 5;
      const miniLesson = Math.min(Math.round(cap * 0.7), 10);
      const debrief = 5;
      return {
        opening: { durationMinutes: opening },
        miniLesson: { durationMinutes: miniLesson },
        workTime: { durationMinutes: usable - opening - miniLesson - debrief },
        debrief: { durationMinutes: debrief },
      };
    },
  },
  {
    id: "instruction-heavy",
    name: "Instruction Heavy",
    description: "More teaching time — good for new skill introduction",
    getPhases: (usable, cap) => {
      const opening = Math.min(10, Math.round(usable * 0.1));
      const miniLesson = cap; // Use full instruction cap
      const debrief = Math.min(10, Math.max(5, Math.round(usable * 0.1)));
      return {
        opening: { durationMinutes: opening },
        miniLesson: { durationMinutes: miniLesson },
        workTime: { durationMinutes: usable - opening - miniLesson - debrief },
        debrief: { durationMinutes: debrief },
      };
    },
  },
  {
    id: "critique-session",
    name: "Critique Session",
    description: "Extended debrief with peer feedback — best mid-unit when students have work to show",
    getPhases: (usable, _cap) => {
      const opening = 5;
      const miniLesson = 5; // Brief re-framing
      const debrief = Math.min(20, Math.round(usable * 0.25));
      return {
        opening: { durationMinutes: opening },
        miniLesson: { durationMinutes: miniLesson },
        workTime: { durationMinutes: usable - opening - miniLesson - debrief },
        debrief: { durationMinutes: debrief, protocol: "gallery-walk" },
      };
    },
  },
];

/**
 * Get a preset by ID.
 */
export function getTimingPreset(id: string): TimingPreset | undefined {
  return TIMING_PRESETS.find((p) => p.id === id);
}

/**
 * Apply a preset to generate workshop phases for a given context.
 */
export function applyTimingPreset(
  presetId: string,
  profile: GradeTimingProfile,
  timingCtx: TimingContext
): WorkshopPhases | null {
  const preset = getTimingPreset(presetId);
  if (!preset) return null;
  const usable = calculateUsableTime(timingCtx);
  const cap = maxInstructionMinutes(profile);
  return preset.getPhases(usable, cap);
}

// =========================================================================
// UDL Coverage Validation (Dimensions v2)
// =========================================================================

/**
 * UDL principle grouping — maps checkpoint ID prefixes to CAST principles.
 * Engagement: 1.x-3.x, Representation: 4.x-6.x, Action & Expression: 7.x-9.x
 */
type UDLPrinciple = "engagement" | "representation" | "action_expression";

function getUDLPrinciple(checkpointId: string): UDLPrinciple | null {
  const num = parseFloat(checkpointId);
  if (isNaN(num)) return null;
  if (num >= 1 && num < 4) return "engagement";
  if (num >= 4 && num < 7) return "representation";
  if (num >= 7 && num <= 9.3) return "action_expression";
  return null;
}

export interface UDLCoverageResult {
  engagement: string[];
  representation: string[];
  action_expression: string[];
  missingPrinciples: UDLPrinciple[];
  coverageScore: number; // 0-3 (how many principles are covered)
  issues: TimingIssue[];
}

/**
 * Check UDL coverage across a unit's activities.
 * Warns if an entire UDL principle (Engagement/Representation/Action & Expression)
 * has zero checkpoints tagged across all lessons.
 *
 * Accepts an array of activity sections that may have `udl_checkpoints` string arrays.
 * These come from the Dimensions v2 schema on generated content.
 */
export function validateUDLCoverage(
  sections: Array<{ udl_checkpoints?: string[]; [key: string]: unknown }>
): UDLCoverageResult {
  const coverage: Record<UDLPrinciple, Set<string>> = {
    engagement: new Set(),
    representation: new Set(),
    action_expression: new Set(),
  };

  for (const section of sections) {
    if (!section.udl_checkpoints?.length) continue;
    for (const cp of section.udl_checkpoints) {
      const principle = getUDLPrinciple(cp);
      if (principle) coverage[principle].add(cp);
    }
  }

  const issues: TimingIssue[] = [];
  const missingPrinciples: UDLPrinciple[] = [];

  const principleLabels: Record<UDLPrinciple, string> = {
    engagement: "Engagement (Why of learning — recruiting interest, sustaining effort, self-regulation)",
    representation: "Representation (What of learning — perception, language & symbols, comprehension)",
    action_expression: "Action & Expression (How of learning — physical action, expression & communication, executive functions)",
  };

  for (const [principle, checkpoints] of Object.entries(coverage) as [UDLPrinciple, Set<string>][]) {
    if (checkpoints.size === 0) {
      missingPrinciples.push(principle);
      issues.push({
        code: `UDL_MISSING_${principle.toUpperCase()}`,
        severity: "info",
        message: `No activities address UDL principle: ${principleLabels[principle]}. Consider adding activities that address this dimension of inclusive design.`,
      });
    }
  }

  return {
    engagement: [...coverage.engagement],
    representation: [...coverage.representation],
    action_expression: [...coverage.action_expression],
    missingPrinciples,
    coverageScore: 3 - missingPrinciples.length,
    issues,
  };
}
