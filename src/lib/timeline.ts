/**
 * Timeline engine — computes lesson boundaries from a flat activity sequence.
 *
 * Activities belong to the unit, not to lessons. Lesson breaks are derived
 * from cumulative duration vs the school's lesson length. When a teacher
 * adjusts an activity's duration, all downstream lesson breaks shift.
 */

import type {
  TimelineActivity,
  ComputedLesson,
  UnitContentDataV4,
  UnitPage,
  PageContent,
  PageType,
} from "@/types";

// ---------------------------------------------------------------------------
// Lesson boundary computation
// ---------------------------------------------------------------------------

/**
 * Walk the timeline and assign activities to lessons using a "slide whole"
 * overflow strategy: if the next activity doesn't fit in the remaining time,
 * it slides to the next lesson (no splitting mid-activity).
 *
 * Oversized activities (longer than lessonLength) get their own lesson.
 */
export function computeLessonBoundaries(
  timeline: TimelineActivity[],
  lessonLengthMinutes: number,
): ComputedLesson[] {
  if (timeline.length === 0) return [];

  const lessons: ComputedLesson[] = [];
  let num = 1;

  let current: ComputedLesson = {
    lessonNumber: num,
    lessonId: lessonId(num),
    activityIds: [],
    totalMinutes: 0,
    slackMinutes: lessonLengthMinutes,
  };

  for (const activity of timeline) {
    const wouldExceed =
      current.activityIds.length > 0 &&
      current.totalMinutes + activity.durationMinutes > lessonLengthMinutes;

    if (wouldExceed) {
      // Finalize current lesson
      current.slackMinutes = lessonLengthMinutes - current.totalMinutes;
      lessons.push(current);

      // Start next
      num += 1;
      current = {
        lessonNumber: num,
        lessonId: lessonId(num),
        activityIds: [],
        totalMinutes: 0,
        slackMinutes: lessonLengthMinutes,
      };
    }

    current.activityIds.push(activity.id);
    current.totalMinutes += activity.durationMinutes;
    current.slackMinutes = lessonLengthMinutes - current.totalMinutes;
  }

  // Push final lesson
  if (current.activityIds.length > 0) {
    lessons.push(current);
  }

  return lessons;
}

/** Format lesson number → "L01", "L02", etc. */
function lessonId(n: number): string {
  return `L${String(n).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// v4 → UnitPage[] adapter (for student view compatibility)
// ---------------------------------------------------------------------------

/**
 * Convert a v4 timeline into the UnitPage[] format consumed by the student
 * view, ChapterNav, and any other component that calls `getPageList()`.
 *
 * Each computed lesson becomes one UnitPage. Activities are mapped by role:
 *   warmup  → PageContent.vocabWarmup
 *   intro   → PageContent.introduction
 *   core    → PageContent.sections[]
 *   reflection → PageContent.reflection
 */
export function v4ToPageList(data: UnitContentDataV4): UnitPage[] {
  const lessons = computeLessonBoundaries(data.timeline, data.lessonLengthMinutes);
  const activityMap = new Map(data.timeline.map((a) => [a.id, a]));

  return lessons.map((lesson) => {
    const activities = lesson.activityIds
      .map((id) => activityMap.get(id))
      .filter((a): a is TimelineActivity => a != null);

    const warmups = activities.filter((a) => a.role === "warmup");
    const intros = activities.filter((a) => a.role === "intro");
    const cores = activities.filter((a) => a.role === "core" || a.role === "content");
    const reflections = activities.filter((a) => a.role === "reflection");

    // Derive lesson title from first core activity or phase label
    const titleSource = cores[0] || intros[0] || activities[0];
    const title = titleSource
      ? titleSource.phaseLabel
        ? `${titleSource.phaseLabel}: ${titleSource.title}`
        : titleSource.title
      : `Lesson ${lesson.lessonNumber}`;

    const content: PageContent = {
      title,
      learningGoal: intros[0]?.prompt || cores[0]?.prompt || "",
      vocabWarmup: warmups.length > 0
        ? { terms: warmups.flatMap((w) => w.vocabTerms || []) }
        : undefined,
      introduction: intros.length > 0
        ? {
            text: intros.map((i) => i.prompt).join("\n\n"),
            media: intros[0].media ? { type: intros[0].media.type, url: intros[0].media.url } : undefined,
            links: intros[0].links,
          }
        : undefined,
      sections: cores.map((a) => ({
        prompt: a.prompt,
        scaffolding: a.scaffolding,
        responseType: a.responseType,
        exampleResponse: a.exampleResponse,
        portfolioCapture: a.portfolioCapture,
        criterionTags: a.criterionTags,
        durationMinutes: a.durationMinutes,
        activityId: a.id,
        media: a.media,
        links: a.links,
        contentStyle: a.contentStyle,
      })),
      reflection: reflections.length > 0
        ? {
            type: reflections[0].reflectionType || "short-response",
            items: reflections[0].reflectionItems || [],
          }
        : undefined,
    };

    // Derive phaseLabel from the first activity that has one
    const phaseLabel = activities.find((a) => a.phaseLabel)?.phaseLabel;

    return {
      id: lesson.lessonId,
      type: "lesson" as PageType,
      phaseLabel,
      title: content.title,
      content,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find which computed lesson an activity belongs to. */
export function findLessonForActivity(
  lessons: ComputedLesson[],
  activityId: string,
): ComputedLesson | undefined {
  return lessons.find((l) => l.activityIds.includes(activityId));
}

/** Get the index in the timeline where a lesson boundary falls (first activity ID). */
export function getLessonBoundaryIndices(
  timeline: TimelineActivity[],
  lessons: ComputedLesson[],
): Map<number, ComputedLesson> {
  const result = new Map<number, ComputedLesson>();
  for (const lesson of lessons) {
    const firstActivityId = lesson.activityIds[0];
    const idx = timeline.findIndex((a) => a.id === firstActivityId);
    if (idx >= 0) result.set(idx, lesson);
  }
  return result;
}
