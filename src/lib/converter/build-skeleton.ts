/**
 * Convert lesson structure extraction into a TimelineSkeleton.
 *
 * Maps the AI-extracted lesson structure to the same format the wizard produces,
 * so the existing generation pipeline can consume it directly.
 */

import type { TimelineLessonSkeleton, TimelineSkeleton, DesignLessonType } from "@/types";
import type { LessonStructureExtraction, ExtractedLesson } from "./extract-lesson-structure";

/**
 * Map extracted activity types to StudioLoom lesson types.
 */
function inferLessonType(lesson: ExtractedLesson): DesignLessonType {
  const activityTypes = lesson.activities.map((a) => a.type);
  const tags = lesson.criterionTags;

  // Primary activity determines lesson type
  if (activityTypes.includes("research")) return "research";
  if (activityTypes.includes("practical")) return "making";
  if (activityTypes.includes("assessment") || activityTypes.includes("reflection")) return "critique";
  if (activityTypes.includes("presentation")) return "critique";

  // Fall back to criterion tags
  if (tags.includes("A")) return "research";
  if (tags.includes("B")) return "ideation";
  if (tags.includes("C")) return "making";
  if (tags.includes("D")) return "critique";

  return "skills-demo";
}

/**
 * Infer the design phase label from criterion tags and lesson type.
 */
function inferPhaseLabel(lesson: ExtractedLesson, lessonType: DesignLessonType): string {
  const typeToPhase: Record<DesignLessonType, string> = {
    research: "Investigation",
    ideation: "Development",
    "skills-demo": "Development",
    making: "Creation",
    testing: "Evaluation",
    critique: "Evaluation",
  };
  return typeToPhase[lessonType] || "Development";
}

/**
 * Extract key vocabulary from activity descriptions.
 */
function extractVocab(lesson: ExtractedLesson): string[] {
  const vocab: string[] = [];
  // Look for materials that sound like vocabulary/concepts
  for (const mat of lesson.materials) {
    if (mat.length < 30 && !mat.includes("/") && !mat.includes("http")) {
      vocab.push(mat);
    }
  }
  return vocab.slice(0, 4);
}

/**
 * Convert activity descriptions to activity hints.
 */
function buildActivityHints(lesson: ExtractedLesson): string[] {
  return lesson.activities.slice(0, 4).map((a) => {
    const prefix = a.type === "discussion" ? "Discussion"
      : a.type === "research" ? "Research"
      : a.type === "practical" ? "Practical"
      : a.type === "presentation" ? "Presentation"
      : a.type === "assessment" ? "Assessment"
      : a.type === "reflection" ? "Reflection"
      : "Activity";

    // Truncate long descriptions
    const desc = a.description.length > 60
      ? a.description.slice(0, 57) + "..."
      : a.description;

    return `${prefix}: ${desc}`;
  });
}

/**
 * Generate a driving question from the learning objective.
 */
function buildKeyQuestion(lesson: ExtractedLesson): string {
  const obj = lesson.learningObjective;
  if (!obj) return `What will we learn in "${lesson.title}"?`;

  // If objective starts with "Students will..." convert to question form
  if (obj.toLowerCase().startsWith("students will")) {
    const action = obj.slice("Students will".length).trim();
    return `How can we ${action.charAt(0).toLowerCase()}${action.slice(1)}?`;
  }

  return `How does ${obj.charAt(0).toLowerCase()}${obj.slice(1)}?`;
}

/**
 * Build a TimelineSkeleton from the extracted lesson structure.
 * This output matches exactly what the wizard's skeleton generation produces.
 */
export function buildSkeletonFromExtraction(
  extraction: LessonStructureExtraction
): TimelineSkeleton {
  const lessons: TimelineLessonSkeleton[] = extraction.lessons.map((lesson, i) => {
    const lessonType = inferLessonType(lesson);
    const phaseLabel = inferPhaseLabel(lesson, lessonType);

    return {
      lessonNumber: i + 1,
      lessonId: `L${String(i + 1).padStart(2, "0")}`,
      title: lesson.title,
      keyQuestion: buildKeyQuestion(lesson),
      estimatedMinutes: lesson.estimatedMinutes || 50,
      phaseLabel,
      criterionTags: lesson.criterionTags.length > 0 ? lesson.criterionTags : ["B"],
      activityHints: buildActivityHints(lesson),
      lessonType,
      learningIntention: lesson.learningObjective
        ? (lesson.learningObjective.startsWith("Students will")
          ? lesson.learningObjective
          : `Students will ${lesson.learningObjective}`)
        : `Students will explore ${lesson.title.toLowerCase()}`,
      successCriteria: lesson.activities.slice(0, 3).map((a) =>
        `Complete ${a.type}: ${a.description.length > 50 ? a.description.slice(0, 47) + "..." : a.description}`
      ),
      cumulativeVocab: extractVocab(lesson),
      cumulativeSkills: lesson.activities
        .filter((a) => a.type === "practical" || a.type === "research")
        .slice(0, 3)
        .map((a) => a.description.length > 40 ? a.description.slice(0, 37) + "..." : a.description),
    };
  });

  // Build narrative arc from the extracted structure
  const phases = [...new Set(lessons.map((l) => l.phaseLabel))];
  const narrativeArc = `This ${extraction.totalLessons}-lesson unit on "${extraction.unitTopic}" takes students through ${phases.join(" → ")}. Converted from the teacher's existing lesson plan, preserving their original activities and teaching approach while adding StudioLoom scaffolding and Workshop Model timing.`;

  return {
    lessons,
    narrativeArc,
  };
}
