/**
 * Timing Validation Engine
 *
 * Validates AI-generated lessons against lesson-type-specific structures
 * and auto-repairs timing issues.
 *
 * Lesson types get their own validated structures:
 * - Workshop Model (default): Opening → Mini-Lesson → Work Time → Debrief
 * - Research: Mini-Lesson → Guided Investigation → Independent Analysis → Share Findings
 * - Ideation: Stimulus → Divergent → Convergent → Select & Refine
 * - Skills-Demo: Safety & Demo → Guided Practice → Independent Practice → Reflection
 * - Making: Safety Check → Extended Making → Clean-Up → Reflection
 * - Testing: Review & Predict → Test & Gather → Analyse → Plan Iteration
 * - Critique: Criteria Reminder → Gallery Walk → Self-Assessment → Goal-Setting
 *
 * Common rules across all types:
 * 1. Instruction cap (1+age) applies where the structure defines instruction phases
 * 2. Main block meets minimum floor % (varies by type)
 * 3. Closing reflection present (varies in duration by type)
 * 4. Section durations sum to usable time (not raw period)
 * 5. No passive phase > 20 min (Y7-9) or > 30 min (Y10+)
 * 6. Extensions present (2-3 per lesson, phase-indexed)
 *
 * Lesson Pulse scoring is UNAFFECTED — it measures activity-level qualities
 * (bloom, agency, grouping), not structural concerns.
 */

import type { GradeTimingProfile } from "./prompts";
import type { TimeWeight } from "@/types";
import { maxInstructionMinutes, MIN_WORK_TIME_PERCENT, calculateUsableTime, type TimingContext } from "./prompts";
import { getLessonStructure, getMainBlockFloor, getEffectiveInstructionCap, structureHasInstructionCap } from "./lesson-structures";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";

// =========================================================================
// Types
// =========================================================================

export interface WorkshopPhases {
  opening: { durationMinutes: number; hook?: string; phaseName?: string };
  miniLesson: { durationMinutes: number; focus?: string; phaseName?: string };
  workTime: { durationMinutes: number; focus?: string; checkpoints?: string[]; phaseName?: string };
  debrief: { durationMinutes: number; protocol?: string; prompt?: string; phaseName?: string };
}

export interface LessonExtension {
  title: string;
  description: string;
  durationMinutes: number;
  designPhase?: "investigation" | "ideation" | "prototyping" | "evaluation";
}

export interface LessonSection {
  /** Composed prompt text — read via composedPromptText(section) when slots are present. */
  prompt?: string;
  // Lever 1 v2 slot fields — when populated, take priority over `prompt`
  framing?: string;
  task?: string;
  success_signal?: string;
  durationMinutes?: number;
  timeWeight?: TimeWeight;
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
// TimeWeight → Minutes Resolution
// =========================================================================

/** Multiplier for each timeWeight value. quick=1x, moderate=2x, extended=4x */
const TIME_WEIGHT_MULTIPLIER: Record<TimeWeight, number> = {
  quick: 1,
  moderate: 2,
  extended: 4,
  flexible: 0, // flexible activities absorb remaining time
};

/**
 * Resolve timeWeight values into concrete durationMinutes for a set of sections
 * within a given available time budget.
 *
 * Algorithm:
 * 1. Sections that already have durationMinutes keep them (pinned).
 * 2. Remaining time is distributed proportionally by timeWeight multiplier.
 * 3. "flexible" sections split whatever time remains after weighted + pinned.
 * 4. Sections with neither timeWeight nor durationMinutes get "moderate" default.
 *
 * Mutates the sections in place and returns the total minutes assigned.
 */
export function resolveTimeWeights(
  sections: LessonSection[],
  availableMinutes: number
): number {
  if (sections.length === 0) return 0;

  // Separate pinned (has durationMinutes) from weighted (needs resolution)
  let pinnedTotal = 0;
  const weighted: { section: LessonSection; multiplier: number }[] = [];
  const flexible: LessonSection[] = [];

  for (const s of sections) {
    if (s.durationMinutes && s.durationMinutes > 0) {
      pinnedTotal += s.durationMinutes;
    } else {
      const tw: TimeWeight = s.timeWeight || "moderate";
      if (tw === "flexible") {
        flexible.push(s);
      } else {
        weighted.push({ section: s, multiplier: TIME_WEIGHT_MULTIPLIER[tw] || 2 });
      }
    }
  }

  const remainingAfterPinned = Math.max(0, availableMinutes - pinnedTotal);

  // Allocate weighted sections proportionally
  const totalWeight = weighted.reduce((sum, w) => sum + w.multiplier, 0);
  // Reserve some time for flexible sections
  const flexReserve = flexible.length > 0
    ? Math.max(flexible.length * 3, Math.round(remainingAfterPinned * 0.15))
    : 0;
  const weightedBudget = remainingAfterPinned - flexReserve;

  let weightedTotal = 0;
  if (totalWeight > 0 && weightedBudget > 0) {
    for (const w of weighted) {
      const minutes = Math.max(2, Math.round((w.multiplier / totalWeight) * weightedBudget));
      w.section.durationMinutes = minutes;
      weightedTotal += minutes;
    }
  } else {
    // Edge case: no weighted sections or no budget — give minimums
    for (const w of weighted) {
      w.section.durationMinutes = 2;
      weightedTotal += 2;
    }
  }

  // Distribute remaining to flexible sections
  const flexBudget = Math.max(0, availableMinutes - pinnedTotal - weightedTotal);
  if (flexible.length > 0) {
    const perFlex = Math.max(3, Math.round(flexBudget / flexible.length));
    for (const s of flexible) {
      s.durationMinutes = perFlex;
    }
  }

  return sections.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
}

/**
 * Get an approximate duration for a single timeWeight value within a lesson context.
 * Used as a fallback when we need a single section's duration without full resolution.
 */
export function approximateDuration(tw: TimeWeight | undefined, lessonMinutes: number): number {
  if (!tw) return Math.round(lessonMinutes * 0.2); // default ~20% of lesson
  switch (tw) {
    case "quick": return Math.min(5, Math.round(lessonMinutes * 0.1));
    case "moderate": return Math.round(lessonMinutes * 0.2);
    case "extended": return Math.round(lessonMinutes * 0.4);
    case "flexible": return Math.round(lessonMinutes * 0.25);
  }
}

// =========================================================================
// Validation Logic
// =========================================================================

/**
 * Validate a generated lesson against lesson-type-specific structure rules.
 * Returns issues found + an auto-repaired copy of the lesson.
 *
 * When lessonType is provided, validation uses the type-specific structure
 * (e.g., critique lessons don't need 45% "work time" because the critique IS the work).
 * When lessonType is absent, falls back to Workshop Model rules.
 */
export function validateLessonTiming(
  lesson: GeneratedLesson,
  profile: GradeTimingProfile,
  timingCtx: TimingContext,
  lessonType?: string
): TimingValidationResult {
  const issues: TimingIssue[] = [];
  // Deep clone for repair
  const repaired: GeneratedLesson = JSON.parse(JSON.stringify(lesson));

  const usable = calculateUsableTime(timingCtx);
  const baseInstructionCap = maxInstructionMinutes(profile);
  const effectiveCap = getEffectiveInstructionCap(baseInstructionCap, lessonType);
  const structure = getLessonStructure(lessonType);
  const mainBlockFloor = getMainBlockFloor(undefined, lessonType);
  const hasInstructionPhase = structureHasInstructionCap(lessonType);

  // ---- 0. Resolve timeWeights → durationMinutes if needed ----
  // Activities may have timeWeight instead of (or in addition to) durationMinutes.
  // Resolve so downstream validation always has concrete minutes.
  if (repaired.sections && repaired.sections.length > 0) {
    const hasMissingDurations = repaired.sections.some(
      (s) => (!s.durationMinutes || s.durationMinutes <= 0) && s.timeWeight
    );
    if (hasMissingDurations) {
      resolveTimeWeights(repaired.sections, usable);
      issues.push({
        code: "TIMEWEIGHT_RESOLVED",
        severity: "info",
        message: "Resolved timeWeight values to concrete durationMinutes.",
        autoFixed: true,
      });
    }
  }

  // ---- 1. Workshop phases present? ----
  // workshopPhases is the legacy 4-phase structure. For typed lessons, we still
  // use it as the phase timing container (mapping type-specific phases onto it)
  // because the entire UI and downstream code reads workshopPhases.
  if (!repaired.workshopPhases) {
    issues.push({
      code: "MISSING_WORKSHOP_PHASES",
      severity: "warning",
      message: `Lesson has no workshopPhases. Auto-generating from sections (structure: ${structure.name}).`,
      autoFixed: true,
    });
    repaired.workshopPhases = inferWorkshopPhases(repaired, usable, effectiveCap);
  }

  const phases = repaired.workshopPhases!;

  // ---- 2. Instruction cap ----
  // Only enforce instruction cap if the lesson structure has instruction phases
  if (hasInstructionPhase && phases.miniLesson.durationMinutes > effectiveCap) {
    issues.push({
      code: "INSTRUCTION_OVER_CAP",
      severity: "warning",
      message: `Instruction phase is ${phases.miniLesson.durationMinutes} min but cap is ${effectiveCap} min${structure.relaxedInstructionCap ? " (relaxed 1.5× for demo)" : ` (1 + age ${profile.avgStudentAge})`}. Clamping.`,
      phase: "miniLesson",
      autoFixed: true,
    });
    const excess = phases.miniLesson.durationMinutes - effectiveCap;
    phases.miniLesson.durationMinutes = effectiveCap;
    // Give excess to work time
    phases.workTime.durationMinutes += excess;
  }

  // ---- 3. Main block floor (varies by lesson type) ----
  const totalPhaseMinutes = phases.opening.durationMinutes + phases.miniLesson.durationMinutes + phases.workTime.durationMinutes + phases.debrief.durationMinutes;
  const mainBlockPercent = phases.workTime.durationMinutes / usable;
  const floorPercent = mainBlockFloor;

  if (mainBlockPercent < floorPercent) {
    const minMainBlock = Math.round(usable * floorPercent);
    issues.push({
      code: "WORK_TIME_TOO_SHORT",
      severity: "error",
      message: `Main block is ${phases.workTime.durationMinutes} min (${Math.round(mainBlockPercent * 100)}%) but ${structure.name} requires minimum ${minMainBlock} min (${Math.round(floorPercent * 100)}%). Redistributing time.`,
      phase: "workTime",
      autoFixed: true,
    });
    // Compress instruction and opening to make room
    const deficit = minMainBlock - phases.workTime.durationMinutes;
    const compressible = phases.miniLesson.durationMinutes - 3 + Math.max(0, phases.opening.durationMinutes - 3);
    if (compressible >= deficit) {
      const fromMiniLesson = Math.min(deficit, phases.miniLesson.durationMinutes - 3);
      phases.miniLesson.durationMinutes -= fromMiniLesson;
      const remaining = deficit - fromMiniLesson;
      if (remaining > 0) {
        phases.opening.durationMinutes -= remaining;
      }
    } else {
      // Do our best — compress both to 3 min
      phases.miniLesson.durationMinutes = 3;
      phases.opening.durationMinutes = 3;
    }
    phases.workTime.durationMinutes = usable - phases.opening.durationMinutes - phases.miniLesson.durationMinutes - phases.debrief.durationMinutes;
  }

  // ---- 4. Closing reflection present ----
  // All structures require some form of closing, but minimum varies
  const minClosing = structure.requiresClosingReflection ? 3 : 0;
  if (structure.requiresClosingReflection && (!phases.debrief || phases.debrief.durationMinutes < minClosing)) {
    issues.push({
      code: "DEBRIEF_TOO_SHORT",
      severity: "warning",
      message: `Closing reflection is ${phases.debrief?.durationMinutes ?? 0} min. Setting to ${Math.max(3, minClosing)} min minimum for ${structure.name}.`,
      phase: "debrief",
      autoFixed: true,
    });
    const debriefNeeded = Math.max(3, minClosing) - (phases.debrief?.durationMinutes ?? 0);
    phases.debrief = {
      ...(phases.debrief || {}),
      durationMinutes: Math.max(3, minClosing),
      ...DEBRIEF_PROTOCOLS["quick-share"],
    };
    if (phases.workTime.durationMinutes > debriefNeeded + 10) {
      phases.workTime.durationMinutes -= debriefNeeded;
    }
  }

  // Ensure debrief has a protocol (only for structures that have a full debrief phase)
  if (phases.debrief && !phases.debrief.protocol && phases.debrief.durationMinutes >= 5) {
    phases.debrief = { ...phases.debrief, ...DEBRIEF_PROTOCOLS["quick-share"] };
    issues.push({
      code: "DEBRIEF_NO_PROTOCOL",
      severity: "info",
      message: "Closing phase had no structured protocol. Added 'quick-share' protocol.",
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
      message: `Phase durations sum to ${repairedTotal} min but usable time is ${usable} min. Adjusting main block.`,
      autoFixed: true,
    });
    phases.workTime.durationMinutes += (usable - repairedTotal);
  }

  // ---- 6. Cognitive load: no passive phase > max ----
  const maxPassive = profile.mypYear <= 3 ? 20 : 30;
  if (repaired.sections) {
    for (const section of repaired.sections) {
      if ((section.durationMinutes || 0) > maxPassive && !isHandsOnSection(section)) {
        // Lever 1: prefer composed slot text for the warning preview so v2
        // sections (where `prompt` may be the auto-composed copy) still
        // surface meaningful labels.
        const preview = composedPromptText(section).slice(0, 50);
        issues.push({
          code: "PASSIVE_PHASE_TOO_LONG",
          severity: "warning",
          message: `Section "${preview}..." is ${section.durationMinutes} min (max passive: ${maxPassive} min for Year ${profile.mypYear}). Consider splitting.`,
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

  // ---- 8. Check-in points for long main blocks ----
  if (phases.workTime.durationMinutes >= 30 && (!phases.workTime.checkpoints || phases.workTime.checkpoints.length === 0)) {
    issues.push({
      code: "MISSING_CHECKPOINTS",
      severity: "info",
      message: `Main block is ${phases.workTime.durationMinutes} min with no checkpoints. Adding a midpoint check-in.`,
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

  // Stamp structure-specific phase names onto the repaired workshopPhases
  if (repaired.workshopPhases) {
    repaired.workshopPhases = stampPhaseNames(repaired.workshopPhases, lessonType);
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
      instructionCap: effectiveCap,
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
  timingCtx: TimingContext,
  /** Optional map of lessonId → lessonType for structure-aware validation */
  lessonTypeMap?: Record<string, string>
): {
  lessonResults: Record<string, TimingValidationResult>;
  unitIssues: TimingIssue[];
} {
  const lessonResults: Record<string, TimingValidationResult> = {};
  const unitIssues: TimingIssue[] = [];

  for (const [id, lesson] of Object.entries(lessons)) {
    lessonResults[id] = validateLessonTiming(lesson, profile, timingCtx, lessonTypeMap?.[id]);
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

  // Check prompt text for active learning verbs — Lever 1: read all three
  // slots (composed) so the v2 `task` body is included in keyword matching.
  const prompt = composedPromptText(section).toLowerCase();
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
  // Resolve any timeWeight-only sections first so we have concrete minutes
  const hasMissingDurations = sections.some(
    (s) => (!s.durationMinutes || s.durationMinutes <= 0) && s.timeWeight
  );
  if (hasMissingDurations) {
    resolveTimeWeights(sections, usableMinutes);
  }
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
      // Lever 1: derive focus from composed text (slots when present)
      focus: (sections[0] ? composedPromptText(sections[0]) : "").slice(0, 100) || "Student creation and practice time",
      checkpoints: workTimeMin >= 30 ? [`At ${Math.round(workTimeMin / 2)} min: Check progress and redirect`] : [],
    },
    debrief: {
      durationMinutes: Math.max(5, debriefMin),
      ...DEBRIEF_PROTOCOLS["quick-share"],
    },
  };
}

/**
 * Stamp structure-specific phase names onto workshopPhases slots.
 * If the AI didn't provide phaseName, we derive it from the lesson structure template.
 * This ensures UI components can display "Extended Making" instead of "Work Time"
 * for a making lesson, while keeping the backward-compatible slot keys.
 */
export function stampPhaseNames(
  phases: WorkshopPhases,
  lessonType?: string
): WorkshopPhases {
  const structure = getLessonStructure(lessonType);
  const templatePhases = structure.phases;

  // Map template phases to the 4 role slots
  // Template phases are ordered: the structure defines them in sequence.
  // Slot mapping: opening=0, miniLesson=1, workTime=mainBlock, debrief=last
  const stamped = JSON.parse(JSON.stringify(phases)) as WorkshopPhases;

  if (templatePhases.length >= 4) {
    stamped.opening.phaseName = stamped.opening.phaseName || templatePhases[0].name;
    stamped.miniLesson.phaseName = stamped.miniLesson.phaseName || templatePhases[1].name;
    // Find the main block phase (or default to index 2)
    const mainIdx = templatePhases.findIndex((p) => p.isMainBlock);
    stamped.workTime.phaseName = stamped.workTime.phaseName || templatePhases[mainIdx >= 0 ? mainIdx : 2].name;
    stamped.debrief.phaseName = stamped.debrief.phaseName || templatePhases[templatePhases.length - 1].name;
  } else {
    // Fallback: Workshop Model names
    stamped.opening.phaseName = stamped.opening.phaseName || "Opening";
    stamped.miniLesson.phaseName = stamped.miniLesson.phaseName || "Mini-Lesson";
    stamped.workTime.phaseName = stamped.workTime.phaseName || "Work Time";
    stamped.debrief.phaseName = stamped.debrief.phaseName || "Debrief";
  }

  return stamped;
}

/**
 * Heuristic check if a section is hands-on (longer attention spans tolerated).
 */
function isHandsOnSection(section: LessonSection): boolean {
  const handsonTypes = ["upload", "canvas", "decision-matrix", "trade-off-sliders"];
  if (section.responseType && handsonTypes.includes(section.responseType)) return true;
  // Lever 1: composed text so v2 `task` body is included in keyword matching
  const prompt = composedPromptText(section).toLowerCase();
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
      const miniLesson = Math.min(Math.floor(cap * 0.65), 9);
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
