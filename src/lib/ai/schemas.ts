/**
 * JSON Schemas for AI structured output (Anthropic tool use / OpenAI function calling).
 *
 * These schemas guarantee the AI produces valid, parseable output that matches
 * our TypeScript types — no more "return ONLY valid JSON" prompt hacks.
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { UnitType } from "./unit-types";

// =========================================================================
// Shared Dimensions Schema Properties (Phase 2 — Data Architecture v2)
// Added to activity sections so AI populates bloom, grouping, ai_rules, etc.
// =========================================================================

/** Dimensions fields for activity sections — shared between page mode and journey mode schemas. */
const dimensionsActivityProperties = {
  bloom_level: {
    type: "string" as const,
    enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
    description: "Bloom's taxonomy level of this activity's primary cognitive demand",
  },
  timeWeight: {
    type: "string" as const,
    enum: ["quick", "moderate", "extended", "flexible"],
    description: "Relative time weight: quick (~5 min), moderate (~10-15 min), extended (~20+ min), flexible (fills remaining phase time)",
  },
  grouping: {
    type: "string" as const,
    enum: ["individual", "pair", "small_group", "whole_class", "mixed"],
    description: "Student grouping strategy for this activity",
  },
  ai_rules: {
    type: "object" as const,
    description: "AI behavior rules if a student uses the Design Assistant during this activity",
    properties: {
      phase: {
        type: "string" as const,
        enum: ["divergent", "convergent", "neutral"],
        description: "divergent = encourage wild ideas (ideation), convergent = push for analysis/evaluation, neutral = balanced",
      },
      tone: { type: "string" as const, description: "Short tone descriptor, e.g. 'encouraging and playful' or 'analytical and precise'" },
      rules: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "1-3 specific rules for the AI mentor during this activity, e.g. 'Never evaluate ideas during brainstorming'",
      },
    },
  },
  udl_checkpoints: {
    type: "array" as const,
    items: { type: "string" as const },
    description: "UDL checkpoint IDs this activity addresses (e.g. '1.1' = recruiting interest, '5.2' = tools and assistive technologies, '7.1' = individual choice). Use CAST UDL 3×3 grid: Engagement (1-3), Representation (4-6), Action & Expression (7-9).",
  },
  success_look_fors: {
    type: "array" as const,
    items: { type: "string" as const },
    description: "1-3 observable indicators of success that a teacher can look for during this activity",
  },
  source_block_id: {
    type: "string" as const,
    description: "If this activity is adapted from a Proven Activity Block, set this to the block's ID (e.g. 'blk_abc123'). Leave empty if the activity is original.",
  },
} as const;

/** Dimensions fields for page-level content — UDL coverage and teacher notes. */
const dimensionsPageProperties = {
  grouping_strategy: {
    type: "string" as const,
    description: "Overall grouping progression for this lesson, e.g. 'whole class (intro) → pairs (ideation) → individual (making) → pairs (critique)'",
  },
  success_criteria: {
    type: "array" as const,
    items: { type: "string" as const },
    description: "2-4 student-friendly success criteria for this lesson (written as 'I can...' statements)",
  },
} as const;

// =========================================================================
// Unit Type-Aware Phase Enums
// =========================================================================

/**
 * Get the activity phase enum values for a specific unit type.
 * This makes schemas dynamic per unit type, so the AI outputs the correct phases.
 */
export function getActivityPhaseEnum(unitType: UnitType = "design"): string[] {
  const phaseMap: Record<UnitType, string[]> = {
    design: ["investigation", "ideation", "prototyping", "evaluation"],
    service: ["investigation", "planning", "action", "reflection", "demonstration"],
    personal_project: ["defining", "planning", "creating", "reflecting", "reporting"],
    inquiry: ["wondering", "exploring", "creating", "sharing"],
  };
  return phaseMap[unitType];
}

// --- Page generation schema (dynamic) ---
// Static schemas have been replaced with dynamic builders that are unit-type-aware.
// See buildPageContentSchema() for the dynamic schema builder.

/**
 * Build a dynamic extensions schema for a specific unit type.
 * This ensures the AI only outputs valid phase enums for the unit type.
 */
function buildExtensionSchema(unitType: UnitType = "design") {
  const phases = getActivityPhaseEnum(unitType);
  return {
    type: "array" as const,
    description: `2-3 extension activities for early finishers, indexed to the current ${
      { design: "design", service: "service", personal_project: "personal project", inquiry: "inquiry" }[unitType]
    } phase`,
    items: {
      type: "object" as const,
      required: ["title", "description", "durationMinutes"],
      properties: {
        title: { type: "string" as const },
        description: { type: "string" as const },
        durationMinutes: { type: "number" as const },
        designPhase: {
          type: "string" as const,
          enum: phases,
          description: "Activity phase for this unit type",
        },
      },
    },
  };
}

/**
 * Build a dynamic page content schema for a specific unit type.
 * Extensions enum is tailored to the unit type.
 */
function buildPageContentSchema(unitType: UnitType = "design") {
  return {
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
        items: {
          type: "object" as const,
          // Lever 1 — three v2 slot fields required. Server composes the
          // legacy `prompt` from framing+task+success_signal at persist time.
          required: ["framing", "task", "success_signal", "responseType"],
          properties: {
            framing: {
              type: "string" as const,
              description: "ONE sentence (≤30 words / ≤200 chars) orienting the student: what they're doing and why it matters today. Direct, second-person. NO meta commentary ('In this activity students...'). NO teacher-side framing. Reads quietly as the lead paragraph.",
            },
            task: {
              type: "string" as const,
              description: "The imperative body — what students actually do. Use a numbered list when there are discrete steps. ≤800 chars. NO `###` headings (silently dropped by renderer). NO `| col | col |` tables (dropped). NO `**Step 1:**` bold sub-headings (use a numbered list instead). Inline `**bold**` / `*italic*` / `[links](url)` / bulleted/numbered lists are fine.",
            },
            success_signal: {
              type: "string" as const,
              description: "ONE short sentence (≤200 chars) telling the student what they should produce, record, submit, or share so they know when they're done. Use a clear production verb: write, record, submit, share, sketch, annotate, present, etc. Renders prefixed with 🎯 + bold. ALWAYS PRESENT — even when the original framing is exploratory, infer one.",
            },
            responseType: {
              type: "string" as const,
              enum: ["text", "upload", "voice", "link", "multi", "decision-matrix", "pmi", "pairwise", "trade-off-sliders"],
            },
            exampleResponse: { type: "string" as const, description: "Model response showing what good work looks like" },
            durationMinutes: { type: "number" as const, description: "DEPRECATED — prefer timeWeight. Only set if exact minutes are critical (e.g. safety demo must be exactly 5 min)." },
            portfolioCapture: {
              type: "boolean" as const,
              description: "Set true for substantive design work (analysis, ideation, creation evidence, evaluation). Omit or false for scaffolding, warm-ups, and practice tasks.",
            },
            // --- Dimensions v2 fields (includes timeWeight which replaces durationMinutes) ---
            ...dimensionsActivityProperties,
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
        },
        description: "2-4 activity sections with student tasks",
      },
      reflection: {
        type: "object" as const,
        properties: {
          type: { type: "string" as const, enum: ["confidence-slider", "checklist", "short-response"] },
          items: { type: "array" as const, items: { type: "string" as const } },
        },
      },
      // --- Dimensions v2 page-level fields ---
      ...dimensionsPageProperties,
      workshopPhases: {
        type: "object" as const,
        description: "Lesson phase timing — 4 role-based slots mapped to the lesson structure described in the prompt. Each slot has a phaseName matching the structure (e.g. 'Extended Making' for a making lesson, 'Divergent Thinking' for ideation). Durations must sum to usable time.",
        properties: {
          opening: {
            type: "object" as const,
            required: ["durationMinutes", "phaseName"],
            properties: {
              durationMinutes: { type: "number" as const, description: "Setup/opening phase duration (typically 3-10 min)" },
              phaseName: { type: "string" as const, description: "Structure-specific phase name (e.g. 'Opening', 'Safety Check', 'Stimulus', 'Review & Predict')" },
              hook: { type: "string" as const, description: "Opening activity, question, or context-setter" },
            },
          },
          miniLesson: {
            type: "object" as const,
            required: ["durationMinutes", "phaseName"],
            properties: {
              durationMinutes: { type: "number" as const, description: "Instruction/guided phase duration. Max 1+age min. Set to 0 if lesson structure has no instruction phase." },
              phaseName: { type: "string" as const, description: "Structure-specific phase name (e.g. 'Mini-Lesson', 'Safety & Demo', 'Guided Investigation', 'Convergent Thinking')" },
              focus: { type: "string" as const, description: "Key concept, skill, or technique being taught/guided" },
            },
          },
          workTime: {
            type: "object" as const,
            required: ["durationMinutes", "phaseName"],
            properties: {
              durationMinutes: { type: "number" as const, description: "Main block — the sustained student work phase. Must meet the minimum floor % for the lesson structure." },
              phaseName: { type: "string" as const, description: "Structure-specific phase name (e.g. 'Work Time', 'Extended Making', 'Divergent Thinking', 'Test & Gather Data', 'Independent Practice')" },
              focus: { type: "string" as const, description: "What students are doing during this phase" },
              checkpoints: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "1-2 brief teacher check-in points for long main blocks (>25 min)",
              },
            },
          },
          debrief: {
            type: "object" as const,
            required: ["durationMinutes", "phaseName"],
            properties: {
              durationMinutes: { type: "number" as const, description: "Closing phase duration (3-10 min). Reflection, sharing, clean-up, or goal-setting." },
              phaseName: { type: "string" as const, description: "Structure-specific phase name (e.g. 'Debrief', 'Quick Reflection', 'Share Findings', 'Select & Refine', 'Plan Iteration')" },
              protocol: { type: "string" as const, description: "Structured closing protocol (e.g. quick-share, i-like-i-wish, exit-ticket, two-stars-a-wish)" },
              prompt: { type: "string" as const, description: "The closing question or activity instructions" },
            },
          },
        },
      },
      extensions: buildExtensionSchema(unitType),
    },
  };
}

/**
 * Tool definition for generating criterion pages.
 * The criterion letter (A/B/C/D) is injected at call time.
 * unitType defaults to "design" for backward compatibility.
 */
export function buildPageGenerationTool(criterion: string, pageCount: number = 4, unitType: UnitType = "design"): Tool {
  const pageKeys = Array.from({ length: pageCount }, (_, i) => `${criterion}${i + 1}`);
  const pageSchema = buildPageContentSchema(unitType);

  const pagesProperties: Record<string, typeof pageSchema> = {};
  for (const key of pageKeys) {
    pagesProperties[key] = pageSchema;
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

/**
 * Build a dynamic journey activity section schema for a specific unit type.
 */
function buildJourneyActivitySectionSchema() {
  return {
    type: "object" as const,
    // Lever 1 — three v2 slot fields required. Server composes the
    // legacy `prompt` from framing+task+success_signal at persist time.
    required: ["framing", "task", "success_signal", "responseType", "criterionTags"],
    properties: {
      framing: {
        type: "string" as const,
        description: "ONE sentence (≤30 words / ≤200 chars) orienting the student: what they're doing and why it matters today. Direct, second-person. NO meta commentary. Reads quietly as the lead paragraph.",
      },
      task: {
        type: "string" as const,
        description: "The imperative body — what students actually do. Use a numbered list when there are discrete steps. ≤800 chars. NO `###` headings (renderer drops them). NO tables. NO `**Step 1:**` bold sub-headings — use a numbered list instead. Inline `**bold**` / `*italic*` / `[links](url)` / bulleted+numbered lists are fine.",
      },
      success_signal: {
        type: "string" as const,
        description: "ONE short sentence (≤200 chars) telling the student what they produce, record, submit, or share. Use a production verb (write/record/submit/share/sketch/annotate/present etc.). Renders with 🎯 prefix + bold. Always present — infer one if exploratory.",
      },
      responseType: {
        type: "string" as const,
        enum: ["text", "upload", "voice", "link", "multi", "decision-matrix", "pmi", "pairwise", "trade-off-sliders"],
      },
      exampleResponse: { type: "string" as const, description: "Model response showing what good work looks like" },
      durationMinutes: { type: "number" as const, description: "DEPRECATED — prefer timeWeight. Only set if exact minutes are critical." },
      portfolioCapture: {
        type: "boolean" as const,
        description: "Set true for substantive design work. Omit or false for scaffolding, warm-ups, and practice tasks.",
      },
      // --- Dimensions v2 fields (includes timeWeight which replaces durationMinutes) ---
      ...dimensionsActivityProperties,
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
      criterionTags: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Assessment criteria this activity addresses (e.g. [\"A\"], [\"B\",\"C\"])",
      },
    },
  };
}

/**
 * Build a dynamic lesson content schema for journey mode.
 * Uses journey-specific activity sections with criterionTags.
 */
function buildLessonContentSchema(unitType: UnitType = "design") {
  const basePageSchema = buildPageContentSchema(unitType);
  const journeyActivitySection = buildJourneyActivitySectionSchema();

  return {
    type: "object" as const,
    required: ["title", "learningGoal", "sections"],
    properties: {
      ...basePageSchema.properties,
      sections: {
        type: "array" as const,
        items: journeyActivitySection,
        description: "2-4 activity sections with student tasks, each tagged with criterionTags",
      },
    },
  };
}

/**
 * Tool definition for generating journey lesson pages.
 * Lesson IDs like "L01", "L02" are injected at call time.
 * unitType defaults to "design" for backward compatibility.
 */
export function buildLessonGenerationTool(lessonIds: string[], unitType: UnitType = "design"): Tool {
  const lessonSchema = buildLessonContentSchema(unitType);
  const lessonsProperties: Record<string, typeof lessonSchema> = {};
  for (const id of lessonIds) {
    lessonsProperties[id] = lessonSchema;
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
  // Lever 1 — three v2 slot fields required. For "content" role
  // (information-only), task carries the body; framing + success_signal
  // can be a brief one-line orient + a "Read it" / "Note the warning"
  // closing cue. Server composes the legacy `prompt` from the slots
  // at persist time.
  required: ["id", "role", "title", "framing", "task", "success_signal"],
  properties: {
    id: { type: "string" as const, description: "Short unique ID for this activity (e.g. 'a1', 'a2', 'a3')" },
    role: {
      type: "string" as const,
      enum: ["warmup", "intro", "core", "reflection", "content"],
      description: "Activity role: warmup (vocab), intro (connect to prior learning), core (main task), reflection (self-assessment), content (information-only — safety warnings, key concepts, context; no student response)",
    },
    title: { type: "string" as const, description: "Short activity title (3-8 words)" },
    framing: {
      type: "string" as const,
      description: "ONE sentence (≤30 words / ≤200 chars) orienting the student. For 'content' role, this is the brief 'why this matters' opener. Reads as the lead paragraph.",
    },
    task: {
      type: "string" as const,
      description: "The imperative body — what students do (or for 'content' role, the information they read). Numbered list for discrete steps. ≤800 chars. NO `###` headings or `| col | col |` tables (renderer drops them). Inline `**bold**`/`*italic*`/`[links](url)`/lists fine.",
    },
    success_signal: {
      type: "string" as const,
      description: "ONE short sentence (≤200 chars) — what students produce/record/submit. For 'content' role this can be a closing cue like 'Note the safety warning before starting' or 'Be ready to apply this in the next activity'. Renders with 🎯 + bold.",
    },
    durationMinutes: { type: "number" as const, description: "Optional fallback — only set if exact minutes are critical (e.g. safety demo must be exactly 5 min). Otherwise use timeWeight." },
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
      enum: ["info", "warning", "tip", "context", "activity", "speaking", "practical"],
      description: "Visual style for content-role blocks: info (blue, key concepts), warning (amber, safety/caution), tip (green, pro tips), context (gray, background), activity (purple, group/classroom activities), speaking (indigo, discussion/presentation), practical (orange, hands-on making/building)",
    },
    exampleResponse: { type: "string" as const, description: "Model response showing what good work looks like" },
    portfolioCapture: { type: "boolean" as const, description: "True for substantive design work that should auto-capture to portfolio" },
    criterionTags: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Assessment criteria this activity addresses (e.g. [\"A\"], [\"B\",\"C\"])",
    },
    phaseLabel: { type: "string" as const, description: "Phase grouping label (e.g. 'Research', 'Prototyping', 'Evaluation')" },
    // --- Dimensions v2 fields ---
    ...dimensionsActivityProperties,
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
    teacherNotes: {
      type: "string" as const,
      description: "Brief teacher guidance: 2-3 circulation questions at different cognitive levels, safety reminders, or differentiation tips",
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
  required: ["lessonNumber", "lessonId", "title", "keyQuestion", "estimatedMinutes", "phaseLabel", "criterionTags", "activityHints", "lessonType", "learningIntention", "successCriteria", "cumulativeVocab", "cumulativeSkills"],
  properties: {
    lessonNumber: { type: "number" as const, description: "1-indexed lesson number" },
    lessonId: { type: "string" as const, description: "Lesson ID like 'L01', 'L02'" },
    title: { type: "string" as const, description: "Concise lesson title" },
    keyQuestion: { type: "string" as const, description: "Driving question for the lesson" },
    estimatedMinutes: { type: "number" as const, description: "Target duration in minutes" },
    phaseLabel: { type: "string" as const, description: "Phase this lesson belongs to (e.g. 'Research', 'Prototyping')" },
    lessonType: {
      type: "string" as const,
      enum: ["research", "ideation", "skills-demo", "making", "testing", "critique"],
      description: "Primary lesson type — determines activity structure and timing",
    },
    learningIntention: {
      type: "string" as const,
      description: "What students will learn/be able to do (process-focused, starts with 'Students will...')",
    },
    successCriteria: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "2-3 observable criteria showing the learning intention was met",
    },
    cumulativeVocab: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Key vocabulary terms introduced IN THIS LESSON (2-4 new terms). These accumulate across lessons for spaced retrieval.",
    },
    cumulativeSkills: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Key skills/techniques introduced IN THIS LESSON (1-3 new skills). These accumulate for spaced retrieval warm-ups.",
    },
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
