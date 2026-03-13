/**
 * JSON Schemas for AI structured output (Anthropic tool use / OpenAI function calling).
 *
 * These schemas guarantee the AI produces valid, parseable output that matches
 * our TypeScript types — no more "return ONLY valid JSON" prompt hacks.
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages";

// --- Page generation schema ---

const activitySectionSchema = {
  type: "object" as const,
  required: ["prompt", "responseType"],
  properties: {
    prompt: { type: "string" as const, description: "Activity instructions for the student" },
    responseType: {
      type: "string" as const,
      enum: ["text", "upload", "voice", "link", "multi", "decision-matrix", "pmi", "pairwise", "trade-off-sliders"],
    },
    exampleResponse: { type: "string" as const, description: "Model response showing what good work looks like" },
    durationMinutes: { type: "number" as const, description: "Estimated minutes for this activity (e.g. 5, 10, 15, 20)" },
    portfolioCapture: {
      type: "boolean" as const,
      description: "Set true for substantive design work (analysis, ideation, creation evidence, evaluation). Omit or false for scaffolding, warm-ups, and practice tasks.",
    },
    scaffolding: {
      type: "object" as const,
      properties: {
        ell1: {
          type: "object" as const,
          properties: {
            sentenceStarters: { type: "array" as const, items: { type: "string" as const } },
            hints: { type: "array" as const, items: { type: "string" as const } },
          },
        },
        ell2: {
          type: "object" as const,
          properties: {
            sentenceStarters: { type: "array" as const, items: { type: "string" as const } },
          },
        },
        ell3: {
          type: "object" as const,
          properties: {
            extensionPrompts: { type: "array" as const, items: { type: "string" as const } },
          },
        },
      },
    },
  },
};

const pageContentSchema = {
  type: "object" as const,
  required: ["title", "learningGoal", "sections"],
  properties: {
    title: { type: "string" as const, description: "Page title" },
    learningGoal: { type: "string" as const, description: "Clear learning objective for this page" },
    vocabWarmup: {
      type: "object" as const,
      properties: {
        terms: {
          type: "array" as const,
          items: {
            type: "object" as const,
            required: ["term", "definition"],
            properties: {
              term: { type: "string" as const },
              definition: { type: "string" as const },
              example: { type: "string" as const },
            },
          },
        },
        activity: {
          type: "object" as const,
          properties: {
            type: { type: "string" as const, enum: ["matching", "fill-blank", "drag-sort"] },
            items: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  question: { type: "string" as const },
                  answer: { type: "string" as const },
                },
              },
            },
          },
        },
      },
    },
    introduction: {
      type: "object" as const,
      properties: {
        text: { type: "string" as const },
        media: {
          type: "object" as const,
          properties: {
            type: { type: "string" as const, enum: ["image", "video"] },
            url: { type: "string" as const },
          },
        },
      },
    },
    sections: {
      type: "array" as const,
      items: activitySectionSchema,
      description: "2-4 activity sections with student tasks",
    },
    reflection: {
      type: "object" as const,
      properties: {
        type: { type: "string" as const, enum: ["confidence-slider", "checklist", "short-response"] },
        items: { type: "array" as const, items: { type: "string" as const } },
      },
    },
  },
};

/**
 * Tool definition for generating criterion pages.
 * The criterion letter (A/B/C/D) is injected at call time.
 */
export function buildPageGenerationTool(criterion: string, pageCount: number = 4): Tool {
  const pageKeys = Array.from({ length: pageCount }, (_, i) => `${criterion}${i + 1}`);

  const pagesProperties: Record<string, typeof pageContentSchema> = {};
  for (const key of pageKeys) {
    pagesProperties[key] = pageContentSchema;
  }

  return {
    name: "output_unit_pages",
    description: `Output the ${pageCount} generated MYP Design unit pages for Criterion ${criterion}`,
    input_schema: {
      type: "object" as const,
      required: pageKeys,
      properties: pagesProperties,
    },
  };
}

// --- Outline generation schema ---

const outlineOptionSchema = {
  type: "object" as const,
  required: ["approach", "description", "strengths", "pages"],
  properties: {
    approach: { type: "string" as const, description: "Name of the pedagogical approach" },
    description: { type: "string" as const, description: "One-paragraph description" },
    strengths: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "2-3 key strengths of this approach",
    },
    pages: {
      type: "object" as const,
      description: "Page outlines keyed by page ID (A1, A2, ..., D4)",
      additionalProperties: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          summary: { type: "string" as const },
        },
        required: ["title", "summary"],
      },
    },
  },
};

export const OUTLINE_GENERATION_TOOL: Tool = {
  name: "output_outline_options",
  description: "Output 3 distinct pedagogical approaches for the unit",
  input_schema: {
    type: "object" as const,
    required: ["options"],
    properties: {
      options: {
        type: "array" as const,
        items: outlineOptionSchema,
        description: "Exactly 3 distinct outline options",
      },
    },
  },
};

// =========================================================================
// Journey Mode — Lesson-based generation schemas
// =========================================================================

/** Activity section schema extended with criterionTags for journey mode. */
const journeyActivitySectionSchema = {
  type: "object" as const,
  required: ["prompt", "responseType", "criterionTags"],
  properties: {
    ...activitySectionSchema.properties,
    criterionTags: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Assessment criteria this activity addresses (e.g. [\"A\"], [\"B\",\"C\"])",
    },
  },
};

/** Lesson content schema — same as pageContentSchema but using journey sections. */
const lessonContentSchema = {
  type: "object" as const,
  required: ["title", "learningGoal", "sections"],
  properties: {
    ...pageContentSchema.properties,
    sections: {
      type: "array" as const,
      items: journeyActivitySectionSchema,
      description: "2-4 activity sections with student tasks, each tagged with criterionTags",
    },
  },
};

/**
 * Tool definition for generating journey lesson pages.
 * Lesson IDs like "L01", "L02" are injected at call time.
 */
export function buildLessonGenerationTool(lessonIds: string[]): Tool {
  const lessonsProperties: Record<string, typeof lessonContentSchema> = {};
  for (const id of lessonIds) {
    lessonsProperties[id] = lessonContentSchema;
  }

  return {
    name: "output_lesson_pages",
    description: `Output ${lessonIds.length} lesson pages for the learning journey`,
    input_schema: {
      type: "object" as const,
      required: lessonIds,
      properties: lessonsProperties,
    },
  };
}

// --- Journey outline schema ---

const journeyOutlineLessonSchema = {
  type: "object" as const,
  required: ["lessonId", "title", "summary", "primaryFocus", "criterionTags"],
  properties: {
    lessonId: { type: "string" as const, description: "Lesson ID (L01, L02, ...)" },
    title: { type: "string" as const, description: "Lesson title" },
    summary: { type: "string" as const, description: "One-sentence description of what students do" },
    primaryFocus: {
      type: "string" as const,
      description: "Primary phase focus: Research, Ideation, Planning, Skill Building, Making, Testing, Iteration, Evaluation, Presentation",
    },
    criterionTags: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Assessment criteria this lesson addresses",
    },
  },
};

const journeyOutlineOptionSchema = {
  type: "object" as const,
  required: ["approach", "description", "strengths", "lessonPlan"],
  properties: {
    approach: { type: "string" as const, description: "Name of the pedagogical approach" },
    description: { type: "string" as const, description: "2-3 sentence description" },
    strengths: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "2-3 key strengths of this approach",
    },
    lessonPlan: {
      type: "array" as const,
      items: journeyOutlineLessonSchema,
      description: "Ordered list of lessons in the journey",
    },
  },
};

export const JOURNEY_OUTLINE_TOOL: Tool = {
  name: "output_journey_outlines",
  description: "Output 3 distinct learning journey approaches for the unit",
  input_schema: {
    type: "object" as const,
    required: ["options"],
    properties: {
      options: {
        type: "array" as const,
        items: journeyOutlineOptionSchema,
        description: "Exactly 3 distinct journey outline options",
      },
    },
  },
};

export const SINGLE_JOURNEY_OUTLINE_TOOL: Tool = {
  name: "output_journey_outline",
  description: "Output a single learning journey approach for the unit",
  input_schema: journeyOutlineOptionSchema,
};

// =========================================================================
// Timeline Mode — Flat activity sequence, lessons derived from duration
// =========================================================================

/** Schema for a single timeline activity. */
const timelineActivitySchema = {
  type: "object" as const,
  required: ["id", "role", "title", "prompt", "durationMinutes"],
  properties: {
    id: { type: "string" as const, description: "Short unique ID for this activity (e.g. 'a1', 'a2', 'a3')" },
    role: {
      type: "string" as const,
      enum: ["warmup", "intro", "core", "reflection", "content"],
      description: "Activity role: warmup (vocab), intro (connect to prior learning), core (main task), reflection (self-assessment), content (information-only — safety warnings, key concepts, context; no student response)",
    },
    title: { type: "string" as const, description: "Short activity title (3-8 words)" },
    prompt: { type: "string" as const, description: "Full activity instructions/content for the student. Supports basic markdown: **bold**, *italic*, [links](url)." },
    durationMinutes: { type: "number" as const, description: "Estimated minutes for this activity" },
    responseType: {
      type: "string" as const,
      enum: ["text", "upload", "voice", "link", "multi", "decision-matrix", "pmi", "pairwise", "trade-off-sliders"],
      description: "Required for core/warmup/intro/reflection roles. Omit for content role.",
    },
    media: {
      type: "object" as const,
      properties: {
        type: { type: "string" as const, enum: ["image", "video"] },
        url: { type: "string" as const, description: "Image URL or standard YouTube/Vimeo watch URL (auto-converted to embed)" },
        caption: { type: "string" as const },
      },
      required: ["type", "url"],
      description: "Optional image or video to display with this activity",
    },
    links: {
      type: "array" as const,
      items: {
        type: "object" as const,
        required: ["url", "label"],
        properties: {
          url: { type: "string" as const },
          label: { type: "string" as const, description: "Button text, e.g. 'Open in TinkerCAD'" },
        },
      },
      description: "External tool links displayed as action buttons",
    },
    contentStyle: {
      type: "string" as const,
      enum: ["info", "warning", "tip", "context"],
      description: "Visual style for content-role blocks: info (blue), warning (amber), tip (green), context (gray default)",
    },
    exampleResponse: { type: "string" as const, description: "Model response showing what good work looks like" },
    portfolioCapture: { type: "boolean" as const, description: "True for substantive design work that should auto-capture to portfolio" },
    criterionTags: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Assessment criteria this activity addresses (e.g. [\"A\"], [\"B\",\"C\"])",
    },
    phaseLabel: { type: "string" as const, description: "Phase grouping label (e.g. 'Research', 'Prototyping', 'Evaluation')" },
    scaffolding: activitySectionSchema.properties.scaffolding,
    vocabTerms: {
      type: "array" as const,
      items: {
        type: "object" as const,
        required: ["term", "definition"],
        properties: {
          term: { type: "string" as const },
          definition: { type: "string" as const },
          example: { type: "string" as const },
        },
      },
      description: "Vocabulary terms (for warmup role activities)",
    },
    reflectionType: {
      type: "string" as const,
      enum: ["confidence-slider", "checklist", "short-response"],
      description: "Reflection format (for reflection role activities)",
    },
    reflectionItems: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Reflection prompts/checklist items (for reflection role activities)",
    },
  },
};

/**
 * Tool definition for generating a batch of timeline activities.
 * Activities are a flat sequence — lesson boundaries are computed client-side.
 */
export function buildTimelineGenerationTool(estimatedCount: number): Tool {
  return {
    name: "output_timeline_activities",
    description: `Output ~${estimatedCount} activities for the unit timeline`,
    input_schema: {
      type: "object" as const,
      required: ["activities"],
      properties: {
        activities: {
          type: "array" as const,
          items: timelineActivitySchema,
          description: `Ordered flat list of ~${estimatedCount} activities for the unit timeline`,
        },
      },
    },
  };
}

// --- Timeline outline schema ---

const timelinePhaseSchema = {
  type: "object" as const,
  required: ["phaseId", "title", "summary", "estimatedLessons", "primaryFocus", "criterionTags"],
  properties: {
    phaseId: { type: "string" as const, description: "Short phase ID (e.g. 'p1', 'p2')" },
    title: { type: "string" as const, description: "Phase title (e.g. 'Research & Discovery')" },
    summary: { type: "string" as const, description: "2-3 sentence description of this phase" },
    estimatedLessons: { type: "number" as const, description: "Approximate number of lessons this phase spans" },
    primaryFocus: {
      type: "string" as const,
      description: "Primary focus: Research, Ideation, Planning, Skill Building, Making, Testing, Iteration, Evaluation, Presentation",
    },
    criterionTags: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Assessment criteria emphasized in this phase",
    },
  },
};

const timelineOutlineOptionSchema = {
  type: "object" as const,
  required: ["approach", "description", "strengths", "phases", "estimatedActivityCount"],
  properties: {
    approach: { type: "string" as const, description: "Name of the pedagogical approach" },
    description: { type: "string" as const, description: "2-3 sentence description" },
    strengths: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "2-3 key strengths of this approach",
    },
    phases: {
      type: "array" as const,
      items: timelinePhaseSchema,
      description: "3-5 phases that make up the learning arc",
    },
    estimatedActivityCount: {
      type: "number" as const,
      description: "Total estimated number of activities across all phases",
    },
  },
};

export const SINGLE_TIMELINE_OUTLINE_TOOL: Tool = {
  name: "output_timeline_outline",
  description: "Output a single timeline-based approach for the unit",
  input_schema: {
    type: "object" as const,
    required: ["approach", "description", "strengths", "phases", "estimatedActivityCount"],
    properties: timelineOutlineOptionSchema.properties,
  },
};

// --- Skeleton schema (fast lesson-level outline) ---

const lessonSkeletonSchema = {
  type: "object" as const,
  required: ["lessonNumber", "lessonId", "title", "keyQuestion", "estimatedMinutes", "phaseLabel", "criterionTags", "activityHints"],
  properties: {
    lessonNumber: { type: "number" as const, description: "1-indexed lesson number" },
    lessonId: { type: "string" as const, description: "Lesson ID like 'L01', 'L02'" },
    title: { type: "string" as const, description: "Concise lesson title" },
    keyQuestion: { type: "string" as const, description: "Driving question for the lesson" },
    estimatedMinutes: { type: "number" as const, description: "Target duration in minutes" },
    phaseLabel: { type: "string" as const, description: "Phase this lesson belongs to (e.g. 'Research', 'Prototyping')" },
    criterionTags: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Assessment criteria emphasized (e.g. ['A'], ['B','C'])",
    },
    activityHints: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "3-4 brief activity hints (e.g. 'Warmup: key vocab', 'Core: product teardown')",
    },
  },
};

export function buildSkeletonGenerationTool(totalLessons: number): Tool {
  return {
    name: "output_lesson_skeleton",
    description: `Output a skeleton of ${totalLessons} lesson outlines for the unit`,
    input_schema: {
      type: "object" as const,
      required: ["lessons", "narrativeArc"],
      properties: {
        lessons: {
          type: "array" as const,
          items: lessonSkeletonSchema,
          description: `Exactly ${totalLessons} lesson skeletons in sequence`,
        },
        narrativeArc: {
          type: "string" as const,
          description: "2-3 sentence summary of how the unit flows emotionally and intellectually",
        },
      },
    },
  };
}

export const TIMELINE_OUTLINE_TOOL: Tool = {
  name: "output_timeline_outlines",
  description: "Output 3 distinct timeline-based approaches for the unit",
  input_schema: {
    type: "object" as const,
    required: ["options"],
    properties: {
      options: {
        type: "array" as const,
        items: timelineOutlineOptionSchema,
        description: "Exactly 3 distinct timeline outline options",
      },
    },
  },
};
