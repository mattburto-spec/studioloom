/**
 * Teacher Style Profile — learned over time from passive and active signals.
 * See docs/ai-intelligence-architecture.md §4 for full design.
 */

export interface TeacherStyleProfile {
  teacherId: string;

  // From uploaded lesson plans (Pass 1 structure extraction)
  lessonPatterns: {
    typicalPhaseSequence: string[];
    averageTheoryPracticalRatio: number;
    averageLessonLength: number;
    preferredActivityTypes: Array<{ type: string; frequency: number }>;
    uploadCount: number;
  };

  // From edits to AI-generated content
  editPatterns: {
    frequentlyDeletedSections: string[];
    frequentlyAddedElements: string[];
    averageTimingAdjustment: number; // negative = teacher shortens, positive = lengthens
    editCount: number;
  };

  // From knowledge base uploads
  resourcePreferences: {
    topUploadCategories: string[];
    referencedFrameworks: string[];
  };

  // From grading patterns
  gradingStyle: {
    averageStrictness: number;
    criterionEmphasis: Record<string, number>;
    feedbackLength: "brief" | "moderate" | "detailed";
    gradingSessionCount: number;
  };

  // Confidence and meta
  confidenceLevel: "cold_start" | "learning" | "established";
  totalUnitsCreated: number;
  totalLessonsEdited: number;
  lastUpdated: string;
}

export type ConfidenceLevel = TeacherStyleProfile["confidenceLevel"];

/**
 * Compute confidence level based on data availability.
 */
export function computeConfidence(profile: TeacherStyleProfile): ConfidenceLevel {
  const dataPoints =
    profile.lessonPatterns.uploadCount +
    profile.editPatterns.editCount +
    profile.totalUnitsCreated +
    profile.gradingStyle.gradingSessionCount;

  if (dataPoints < 5) return "cold_start";
  if (dataPoints < 20) return "learning";
  return "established";
}

/**
 * Create an empty cold-start profile for a new teacher.
 */
export function createEmptyProfile(teacherId: string): TeacherStyleProfile {
  return {
    teacherId,
    lessonPatterns: {
      typicalPhaseSequence: [],
      averageTheoryPracticalRatio: 0.4,
      averageLessonLength: 50,
      preferredActivityTypes: [],
      uploadCount: 0,
    },
    editPatterns: {
      frequentlyDeletedSections: [],
      frequentlyAddedElements: [],
      averageTimingAdjustment: 0,
      editCount: 0,
    },
    resourcePreferences: {
      topUploadCategories: [],
      referencedFrameworks: [],
    },
    gradingStyle: {
      averageStrictness: 0.5,
      criterionEmphasis: {},
      feedbackLength: "moderate",
      gradingSessionCount: 0,
    },
    confidenceLevel: "cold_start",
    totalUnitsCreated: 0,
    totalLessonsEdited: 0,
    lastUpdated: new Date().toISOString(),
  };
}
