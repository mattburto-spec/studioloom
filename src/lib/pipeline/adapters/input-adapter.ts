/**
 * Input Adapter — W1
 * Bridges UnitWizardInput (wizard) → GenerationRequest (pipeline)
 */

import type { UnitWizardInput } from "@/types";
import type { GenerationRequest } from "@/types/activity-blocks";

const DEFAULT_LESSONS_PER_WEEK = 2;
const MAX_LESSON_COUNT = 20;
const DEFAULT_PERIOD_MINUTES = 60;

/**
 * Convert wizard-collected input into the pipeline's GenerationRequest format.
 */
export function wizardInputToGenerationRequest(input: UnitWizardInput): GenerationRequest {
  // Derive lesson count from duration weeks (default 2 per week, cap at 20)
  const weeks = input.durationWeeks || 4;
  const lessonCount = Math.min(Math.max(weeks * DEFAULT_LESSONS_PER_WEEK, 1), MAX_LESSON_COUNT);

  // Parse special requirements for workshop/resource hints
  const specialReq = (input.specialRequirements || "").toLowerCase();
  const workshopAccess = !specialReq.includes("no workshop") && !specialReq.includes("no tools");

  // Extract any mentioned software from special requirements
  const softwareKeywords = ["fusion 360", "tinkercad", "solidworks", "autocad", "figma", "canva", "photoshop", "illustrator", "blender"];
  const softwareAvailable = softwareKeywords.filter(sw => specialReq.includes(sw));

  // Extract resource hints
  const availableResources: string[] = [];
  if (input.resourceUrls?.length) {
    availableResources.push(...input.resourceUrls);
  }

  // Convert criteriaFocus to numeric weights
  const criteriaEmphasis: Record<string, number> | undefined =
    input.criteriaFocus && Object.keys(input.criteriaFocus).length > 0
      ? Object.fromEntries(
          Object.entries(input.criteriaFocus).map(([key, level]) => [
            key,
            level === "emphasis" ? 1.5 : level === "light" ? 0.5 : 1.0,
          ])
        )
      : undefined;

  return {
    topic: input.topic || input.title || "Untitled Unit",
    unitType: input.unitType || "design",
    lessonCount,
    gradeLevel: input.gradeLevel || "Year 3 (Grade 8)",
    framework: input.framework || "IB_MYP",
    constraints: {
      availableResources,
      periodMinutes: DEFAULT_PERIOD_MINUTES,
      workshopAccess,
      softwareAvailable,
    },
    context: {
      realWorldContext: input.realWorldContext || undefined,
      studentContext: input.studentContext || undefined,
      classroomConstraints: input.classroomConstraints || undefined,
    },
    preferences: {
      emphasisAreas: input.selectedCriteria?.length ? input.selectedCriteria : undefined,
      criteriaEmphasis,
    },
    curriculumContext: input.curriculumContext || undefined,
  };
}
