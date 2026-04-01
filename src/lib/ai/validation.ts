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

  // Post-validation: enforce activity ordering within each lesson batch.
  // Warmup activities must come first, reflection/exit activities must come last.
  // The AI sometimes places exit/debrief activities mid-lesson — reorder them.
  const reordered = enforceActivityOrdering(valid);
  if (reordered.reordered) {
    errors.push("Reordered activities: moved exit/reflection activities to end of sequence");
  }

  return {
    valid: errors.length === 0,
    errors,
    activities: reordered.activities,
  };
}

/**
 * Enforce Workshop Model activity ordering:
 * warmup first → intro/content/core in middle → reflection/exit last.
 *
 * Detects misplaced exit/reflection activities by role AND by title keywords,
 * then moves them to the end of the sequence.
 */
function enforceActivityOrdering(activities: TimelineActivity[]): { activities: TimelineActivity[]; reordered: boolean } {
  if (activities.length <= 1) return { activities, reordered: false };

  const EXIT_KEYWORDS = /\b(exit|debrief|wrap[- ]?up|closing|whip[- ]?around|lesson exit|one[- ]?word)\b/i;

  // Separate into 3 buckets: warmups, middle (core/content/intro), exits (reflection + exit-titled)
  const warmups: TimelineActivity[] = [];
  const middle: TimelineActivity[] = [];
  const exits: TimelineActivity[] = [];

  for (const a of activities) {
    if (a.role === "warmup") {
      warmups.push(a);
    } else if (a.role === "reflection") {
      exits.push(a);
    } else if (EXIT_KEYWORDS.test(a.title || "")) {
      // Core/content activity with exit-like title — treat as exit
      exits.push(a);
    } else {
      middle.push(a);
    }
  }

  // Check if reordering actually changed anything
  const reorderedList = [...warmups, ...middle, ...exits];
  const wasReordered = reorderedList.some((a, i) => a !== activities[i]);

  return { activities: reorderedList, reordered: wasReordered };
}
