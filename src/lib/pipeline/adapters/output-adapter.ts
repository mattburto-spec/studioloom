/**
 * Output Adapter — W2
 * Converts pipeline TimedUnit → UnitContentDataV2 (what the lesson editor, Teaching Mode, and student pages expect)
 */

import { customAlphabet } from "nanoid";
import type { UnitWizardInput, UnitPage, UnitContentDataV2, PageContent, ActivitySection, WorkshopPhases } from "@/types";
import type { TimedUnit, TimedLesson, PolishedActivity, QualityReport, TimedPhase, LessonExtension as PipelineLessonExtension } from "@/types/activity-blocks";
import type { LessonExtension } from "@/types";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

// Phase label → WorkshopPhases key mapping
const PHASE_MAP: Record<string, keyof WorkshopPhases> = {
  opening: "opening",
  warmup: "opening",
  "mini-lesson": "miniLesson",
  instruction: "miniLesson",
  "mini_lesson": "miniLesson",
  minilesson: "miniLesson",
  core: "workTime",
  "work-time": "workTime",
  work_time: "workTime",
  worktime: "workTime",
  reflection: "debrief",
  debrief: "debrief",
  wrapup: "debrief",
  "wrap-up": "debrief",
};

function mapPhaseToWorkshop(phaseLabel: string): keyof WorkshopPhases {
  const lower = phaseLabel.toLowerCase().replace(/\s+/g, "-");
  return PHASE_MAP[lower] || "workTime";
}

/**
 * Convert a pipeline PolishedActivity into the ActivitySection format used by the lesson editor.
 */
function activityToSection(activity: PolishedActivity, index: number): ActivitySection {
  // Lever 1 — compose legacy prompt from the three slot fields when
  // upstream provided them. Falls back to existing prompt + title when
  // upstream is library-source pre-Lever-1 shape.
  const slots = [activity.framing, activity.task, activity.success_signal]
    .filter((s) => s && s.trim());
  const composedPrompt = slots.length > 0 ? slots.join("\n\n") : (activity.prompt || activity.title);
  return {
    framing: activity.framing || undefined,
    task: activity.task || undefined,
    success_signal: activity.success_signal || undefined,
    prompt: composedPrompt,
    scaffolding: activity.scaffolding
      ? {
          ell1: { sentenceStarters: activity.scaffolding.sentence_starters, hints: activity.scaffolding.hints },
          ell2: { sentenceStarters: activity.scaffolding.sentence_starters },
          ell3: { extensionPrompts: [] },
        }
      : undefined,
    responseType: mapResponseType(activity.response_type),
    activityId: `act_${nanoid()}`,
    bloom_level: activity.bloom_level as ActivitySection["bloom_level"],
    timeWeight: activity.time_weight as ActivitySection["timeWeight"],
    grouping: mapGrouping(activity.grouping),
    ai_rules: activity.ai_rules
      ? {
          phase: activity.ai_rules.phase as "divergent" | "convergent" | "neutral",
          tone: activity.ai_rules.tone,
          rules: activity.ai_rules.rules,
          forbidden_words: activity.ai_rules.forbidden_words,
        }
      : undefined,
    udl_checkpoints: activity.udl_checkpoints,
    success_look_fors: activity.success_look_fors,
    source_block_id: activity.sourceBlockId || undefined,
    tags: [activity.activity_category, activity.phase].filter(Boolean),
  };
}

function mapResponseType(responseType: string | undefined): ActivitySection["responseType"] {
  const valid = ["text", "upload", "voice", "link", "multi", "canvas", "decision-matrix", "pmi", "pairwise", "trade-off-sliders", "toolkit-tool"];
  if (responseType && valid.includes(responseType)) {
    return responseType as ActivitySection["responseType"];
  }
  return "text";
}

function mapGrouping(grouping: string | undefined): ActivitySection["grouping"] {
  const map: Record<string, ActivitySection["grouping"]> = {
    individual: "individual",
    pair: "pair",
    small_group: "small_group",
    whole_class: "whole_class",
    flexible: "mixed",
  };
  return (grouping && map[grouping]) || "individual";
}

/**
 * Build WorkshopPhases from the timed phases of a lesson.
 */
function buildWorkshopPhases(lesson: TimedLesson): WorkshopPhases {
  const phases: WorkshopPhases = {
    opening: { durationMinutes: 5 },
    miniLesson: { durationMinutes: 10 },
    workTime: { durationMinutes: Math.max(lesson.totalMinutes - 25, 20) },
    debrief: { durationMinutes: 5 },
  };

  if (lesson.phases?.length) {
    // Reset to zero, then accumulate from timed phases
    phases.opening.durationMinutes = 0;
    phases.miniLesson.durationMinutes = 0;
    phases.workTime.durationMinutes = 0;
    phases.debrief.durationMinutes = 0;

    for (const timedPhase of lesson.phases) {
      const workshopKey = mapPhaseToWorkshop(timedPhase.label || timedPhase.phaseId);
      phases[workshopKey].durationMinutes += timedPhase.durationMinutes;

      // Copy phase-specific metadata
      if (workshopKey === "opening" && timedPhase.activities[0]) {
        phases.opening.hook = timedPhase.activities[0].title;
      }
      if (workshopKey === "miniLesson" && timedPhase.activities[0]) {
        phases.miniLesson.focus = timedPhase.activities[0].title;
      }
      if (workshopKey === "debrief" && timedPhase.activities[0]) {
        phases.debrief.prompt = timedPhase.activities[0].prompt;
      }
    }

    // Ensure minimum durations
    if (phases.opening.durationMinutes === 0) phases.opening.durationMinutes = 5;
    if (phases.miniLesson.durationMinutes === 0) phases.miniLesson.durationMinutes = 5;
    if (phases.workTime.durationMinutes === 0) phases.workTime.durationMinutes = 20;
    if (phases.debrief.durationMinutes === 0) phases.debrief.durationMinutes = 5;
  }

  return phases;
}

/**
 * Convert pipeline LessonExtension to the unit content format.
 */
function convertExtensions(extensions?: PipelineLessonExtension[]): LessonExtension[] | undefined {
  if (!extensions?.length) return undefined;
  return extensions.map(ext => ({
    title: ext.title,
    description: ext.description,
    durationMinutes: ext.duration,
    designPhase: ext.designPhase as LessonExtension["designPhase"],
  }));
}

/**
 * Convert a TimedLesson into a UnitPage.
 */
function lessonToPage(lesson: TimedLesson, index: number): UnitPage {
  // Collect all activities across all phases
  const allActivities: PolishedActivity[] = [];
  if (lesson.phases?.length) {
    for (const phase of lesson.phases) {
      allActivities.push(...phase.activities);
    }
  } else if (lesson.activities?.length) {
    allActivities.push(...lesson.activities);
  }

  const sections: ActivitySection[] = allActivities.map((act, i) => activityToSection(act, i));

  const content: PageContent = {
    title: lesson.label || `Lesson ${index + 1}`,
    learningGoal: lesson.learningGoal || lesson.description || "",
    sections,
    workshopPhases: buildWorkshopPhases(lesson),
    extensions: convertExtensions(lesson.extensions),
  };

  return {
    id: `page_${nanoid()}`,
    type: "strand",
    title: lesson.label || `Lesson ${index + 1}`,
    content,
  };
}

/**
 * Main output adapter: converts pipeline TimedUnit + QualityReport into the
 * UnitContentDataV2 format that the lesson editor, Teaching Mode, and student pages consume.
 */
export function timedUnitToContentData(
  timedUnit: TimedUnit,
  qualityReport: QualityReport,
  wizardInput: UnitWizardInput,
): { contentData: UnitContentDataV2; pages: UnitPage[] } {
  const pages: UnitPage[] = timedUnit.lessons.map((lesson, i) => lessonToPage(lesson, i));

  const contentData: UnitContentDataV2 = {
    version: 2,
    pages,
  };

  return { contentData, pages };
}
