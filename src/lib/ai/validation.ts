import type { PageContent, TimelineActivity } from "@/types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  pages: Record<string, PageContent>;
}

const VALID_RESPONSE_TYPES = ["text", "upload", "voice", "link", "multi", "decision-matrix", "pmi", "pairwise", "trade-off-sliders"];
const VALID_REFLECTION_TYPES = ["confidence-slider", "checklist", "short-response"];
const VALID_VOCAB_ACTIVITY_TYPES = ["matching", "fill-blank", "drag-sort"];

/**
 * Validate AI-generated pages match the PageContent schema.
 * Fixes minor issues where possible, reports unfixable ones.
 */
export function validateGeneratedPages(
  pages: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const validPages: Record<string, PageContent> = {};

  for (const [pageId, rawPage] of Object.entries(pages)) {
    if (!rawPage || typeof rawPage !== "object") {
      errors.push(`${pageId}: Not a valid object`);
      continue;
    }

    const page = rawPage as Record<string, unknown>;

    // Required: title
    if (!page.title || typeof page.title !== "string") {
      errors.push(`${pageId}: Missing or invalid 'title'`);
      continue;
    }

    // Required: learningGoal
    if (!page.learningGoal || typeof page.learningGoal !== "string") {
      errors.push(`${pageId}: Missing or invalid 'learningGoal'`);
      continue;
    }

    // Required: sections array
    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      errors.push(`${pageId}: Missing or empty 'sections' array`);
      continue;
    }

    // Validate sections
    const validSections = [];
    for (let i = 0; i < page.sections.length; i++) {
      const section = page.sections[i] as Record<string, unknown>;

      if (!section.prompt || typeof section.prompt !== "string") {
        errors.push(`${pageId}.sections[${i}]: Missing 'prompt'`);
        continue;
      }

      // Fix invalid responseType to "text"
      if (!section.responseType || !VALID_RESPONSE_TYPES.includes(section.responseType as string)) {
        section.responseType = "text";
      }

      validSections.push(section);
    }

    if (validSections.length === 0) {
      errors.push(`${pageId}: No valid sections after validation`);
      continue;
    }

    // Validate optional vocabWarmup
    if (page.vocabWarmup) {
      const vocab = page.vocabWarmup as Record<string, unknown>;
      if (!Array.isArray(vocab.terms)) {
        page.vocabWarmup = undefined;
      } else if (vocab.activity) {
        const activity = vocab.activity as Record<string, unknown>;
        if (!VALID_VOCAB_ACTIVITY_TYPES.includes(activity.type as string)) {
          activity.type = "matching";
        }
      }
    }

    // Validate optional reflection
    if (page.reflection) {
      const reflection = page.reflection as Record<string, unknown>;
      if (!VALID_REFLECTION_TYPES.includes(reflection.type as string)) {
        reflection.type = "confidence-slider";
      }
      if (!Array.isArray(reflection.items)) {
        reflection.items = ["I understand the task"];
      }
    }

    // Build the validated page
    validPages[pageId] = {
      title: page.title as string,
      learningGoal: page.learningGoal as string,
      vocabWarmup: page.vocabWarmup as PageContent["vocabWarmup"],
      introduction: page.introduction as PageContent["introduction"],
      sections: validSections as unknown as PageContent["sections"],
      reflection: page.reflection as PageContent["reflection"],
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    pages: validPages,
  };
}

// ---------------------------------------------------------------------------
// Timeline activity validation
// ---------------------------------------------------------------------------

const VALID_ROLES = ["warmup", "intro", "core", "reflection", "content"];

interface TimelineValidationResult {
  valid: boolean;
  errors: string[];
  activities: TimelineActivity[];
}

/**
 * Validate AI-generated timeline activities.
 * Fixes minor issues where possible, reports unfixable ones.
 */
export function validateTimelineActivities(
  activities: unknown[]
): TimelineValidationResult {
  const errors: string[] = [];
  const valid: TimelineActivity[] = [];

  for (let i = 0; i < activities.length; i++) {
    const raw = activities[i];
    if (!raw || typeof raw !== "object") {
      errors.push(`Activity[${i}]: Not a valid object`);
      continue;
    }

    const a = raw as Record<string, unknown>;

    // Required: id
    if (!a.id || typeof a.id !== "string") {
      errors.push(`Activity[${i}]: Missing 'id'`);
      continue;
    }

    // Required: role
    if (!a.role || !VALID_ROLES.includes(a.role as string)) {
      a.role = "core"; // default to core if invalid
      errors.push(`Activity[${i}] (${a.id}): Invalid role, defaulted to 'core'`);
    }

    // Required: title
    if (!a.title || typeof a.title !== "string") {
      errors.push(`Activity[${i}] (${a.id}): Missing 'title'`);
      continue;
    }

    // Required: prompt
    if (!a.prompt || typeof a.prompt !== "string") {
      errors.push(`Activity[${i}] (${a.id}): Missing 'prompt'`);
      continue;
    }

    // Required: durationMinutes
    if (typeof a.durationMinutes !== "number" || a.durationMinutes <= 0) {
      a.durationMinutes = 10; // default to 10 min
      errors.push(`Activity[${i}] (${a.id}): Invalid durationMinutes, defaulted to 10`);
    }

    // Fix invalid responseType — content role doesn't need one
    if (a.role !== "content") {
      if (!a.responseType || !VALID_RESPONSE_TYPES.includes(a.responseType as string)) {
        a.responseType = "text";
      }
    }

    // Validate media if present
    if (a.media && typeof a.media === "object") {
      const m = a.media as Record<string, unknown>;
      if (!m.type || !m.url || typeof m.url !== "string") {
        delete a.media;
        errors.push(`Activity[${i}] (${a.id}): Invalid media object, removed`);
      }
    }

    // Validate links if present
    if (a.links && Array.isArray(a.links)) {
      a.links = (a.links as Record<string, unknown>[]).filter((l) =>
        l && typeof l.url === "string" && typeof l.label === "string"
      );
    }

    valid.push(a as unknown as TimelineActivity);
  }

  return {
    valid: errors.length === 0,
    errors,
    activities: valid,
  };
}
