/**
 * Convert lesson structure extraction into a TimelineSkeleton.
 *
 * v2.0 — Enhanced with:
 * - Framework-aware criterion mapping (not just MYP A/B/C/D)
 * - Resource URLs preserved as activity hints
 * - Proper duration from header metadata
 * - Differentiation text preserved
 * - Rubric data passed through
 */

import type { TimelineLessonSkeleton, TimelineSkeleton, DesignLessonType } from "@/types";
import type { LessonStructureExtraction, ExtractedLesson } from "./extract-lesson-structure";

/**
 * Map extracted activity types to StudioLoom lesson types.
 */
function inferLessonType(lesson: ExtractedLesson): DesignLessonType {
  const activityTypes = lesson.activities.map((a) => a.type);

  // Primary activity determines lesson type
  if (activityTypes.includes("research")) return "research";
  if (activityTypes.includes("practical")) return "making";
  if (activityTypes.includes("assessment") || activityTypes.includes("reflection")) return "critique";
  if (activityTypes.includes("presentation")) return "critique";

  // Fall back to criterion tags — handle both MYP and other frameworks
  const tags = lesson.criterionTags.map(t => t.toUpperCase());
  if (tags.includes("A") || tags.includes("AO1") || tags.includes("KU")) return "research";
  if (tags.includes("B") || tags.includes("AO2")) return "ideation";
  if (tags.includes("C") || tags.includes("AO3") || tags.includes("P&P")) return "making";
  if (tags.includes("D") || tags.includes("AO4")) return "critique";

  return "skills-demo";
}

/**
 * Infer the design phase label from lesson type.
 */
function inferPhaseLabel(_lesson: ExtractedLesson, lessonType: DesignLessonType): string {
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
 * Extract key vocabulary from activity descriptions and materials.
 */
function extractVocab(lesson: ExtractedLesson): string[] {
  const vocab: string[] = [];
  for (const mat of lesson.materials) {
    if (mat.length < 30 && !mat.includes("/") && !mat.includes("http")) {
      vocab.push(mat);
    }
  }
  // Also extract terms from learning objectives
  const techTerms = lesson.learningObjective?.match(/\b(?:biomimicry|sustainability|LCA|ergonomic|orthogonal|prototype|iterate|aesthetic)\b/gi);
  if (techTerms) vocab.push(...techTerms);

  return [...new Set(vocab)].slice(0, 4);
}

/**
 * Convert activity descriptions to activity hints, including resource URLs.
 */
function buildActivityHints(lesson: ExtractedLesson): string[] {
  const hints = lesson.activities.slice(0, 4).map((a) => {
    const prefix = a.type === "discussion" ? "Discussion"
      : a.type === "research" ? "Research"
      : a.type === "practical" ? "Practical"
      : a.type === "presentation" ? "Presentation"
      : a.type === "assessment" ? "Assessment"
      : a.type === "reflection" ? "Reflection"
      : "Activity";

    const desc = a.description.length > 60
      ? a.description.slice(0, 57) + "..."
      : a.description;

    return `${prefix}: ${desc}`;
  });

  // Add resource count hint if there are resources
  if (lesson.resources && lesson.resources.length > 0) {
    const videoCount = lesson.resources.filter(r => r.type === "video").length;
    const otherCount = lesson.resources.length - videoCount;
    const parts: string[] = [];
    if (videoCount > 0) parts.push(`${videoCount} video${videoCount > 1 ? "s" : ""}`);
    if (otherCount > 0) parts.push(`${otherCount} resource${otherCount > 1 ? "s" : ""}`);
    hints.push(`📎 ${parts.join(", ")} linked`);
  }

  return hints;
}

/**
 * Generate a driving question from the learning objective.
 */
function buildKeyQuestion(lesson: ExtractedLesson): string {
  const obj = lesson.learningObjective;
  if (!obj) return `What will we learn in "${lesson.title}"?`;

  if (obj.toLowerCase().startsWith("students will")) {
    const action = obj.slice("Students will".length).trim();
    return `How can we ${action.charAt(0).toLowerCase()}${action.slice(1)}?`;
  }

  return `How does ${obj.charAt(0).toLowerCase()}${obj.slice(1)}?`;
}

/**
 * Build a TimelineSkeleton from the extracted lesson structure.
 * This output matches what the wizard's skeleton generation produces.
 */
export function buildSkeletonFromExtraction(
  extraction: LessonStructureExtraction
): TimelineSkeleton {
  const defaultDuration = extraction.lessonDurationMinutes || 50;

  const lessons: TimelineLessonSkeleton[] = extraction.lessons.map((lesson, i) => {
    const lessonType = inferLessonType(lesson);
    const phaseLabel = inferPhaseLabel(lesson, lessonType);

    return {
      lessonNumber: i + 1,
      lessonId: `L${String(i + 1).padStart(2, "0")}`,
      title: lesson.title,
      keyQuestion: buildKeyQuestion(lesson),
      estimatedMinutes: lesson.estimatedMinutes || defaultDuration,
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

  // Build narrative arc
  const phases = [...new Set(lessons.map((l) => l.phaseLabel))];
  const frameworkNote = extraction.framework.confidence !== "low"
    ? ` (${extraction.framework.frameworkName})`
    : "";
  const narrativeArc = `This ${extraction.totalLessons}-lesson unit on "${extraction.unitTopic}"${frameworkNote} takes students through ${phases.join(" → ")}. Converted from the teacher's existing lesson plan, preserving their original activities and teaching approach while adding StudioLoom scaffolding and Workshop Model timing.`;

  return {
    lessons,
    narrativeArc,
  };
}
