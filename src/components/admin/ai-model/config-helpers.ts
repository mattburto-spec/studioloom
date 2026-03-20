import type {
  AIModelConfig,
  ResolvedModelConfig,
} from "@/types/ai-model-config";
import { DEFAULT_MODEL_CONFIG, CATEGORY_META } from "@/lib/ai/model-config-defaults";

// =========================================================================
// Types
// =========================================================================

export type CategoryKey = keyof AIModelConfig | "timingProfiles";

export interface TestInput {
  topic: string;
  gradeLevel: string;
  endGoal: string;
  lessonCount: number;
  lessonLengthMinutes: number;
}

export type Action =
  | { type: "SET_FULL"; config: ResolvedModelConfig }
  | { type: "SET_SLIDER"; category: string; key: string; value: number }
  | { type: "SET_TIMING"; year: number; field: string; value: number }
  | { type: "RESET_CATEGORY"; category: string }
  | { type: "RESET_ALL" };

// =========================================================================
// Reducer
// =========================================================================

export function configReducer(state: ResolvedModelConfig, action: Action): ResolvedModelConfig {
  switch (action.type) {
    case "SET_FULL":
      return action.config;

    case "SET_SLIDER": {
      const cat = action.category as keyof ResolvedModelConfig;
      const current = state[cat];
      if (typeof current === "object" && current !== null && !Array.isArray(current)) {
        return {
          ...state,
          [cat]: { ...current, [action.key]: action.value },
        };
      }
      return state;
    }

    case "SET_TIMING": {
      const profiles = { ...state.timingProfiles };
      if (profiles[action.year]) {
        profiles[action.year] = {
          ...profiles[action.year],
          [action.field]: action.value,
        };
      }
      return { ...state, timingProfiles: profiles };
    }

    case "RESET_CATEGORY": {
      const cat = action.category as keyof ResolvedModelConfig;
      return {
        ...state,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [cat]: (DEFAULT_MODEL_CONFIG as unknown as Record<string, any>)[cat],
      };
    }

    case "RESET_ALL":
      return { ...DEFAULT_MODEL_CONFIG };

    default:
      return state;
  }
}

// =========================================================================
// Helper: compute diff (only non-default values)
// =========================================================================

export function computeDiff(current: ResolvedModelConfig): AIModelConfig {
  const diff: AIModelConfig = {};
  const d = DEFAULT_MODEL_CONFIG;

  // Simple categories
  for (const cat of CATEGORY_META) {
    const key = cat.key as keyof ResolvedModelConfig;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentCat = current[key] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultCat = d[key] as any;
    const catDiff: Record<string, number> = {};
    let hasChanges = false;
    for (const k of Object.keys(defaultCat)) {
      if (currentCat[k] !== defaultCat[k]) {
        catDiff[k] = currentCat[k];
        hasChanges = true;
      }
    }
    if (hasChanges) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (diff as any)[key] = catDiff;
    }
  }

  // Timing profiles
  const timingDiff: Record<number, Record<string, unknown>> = {};
  let hasTimingChanges = false;
  for (const year of [1, 2, 3, 4, 5]) {
    const cur = current.timingProfiles[year];
    const def = d.timingProfiles[year];
    if (!cur || !def) continue;
    const yearDiff: Record<string, unknown> = {};
    let yearHasChanges = false;
    for (const field of Object.keys(def) as (keyof typeof def)[]) {
      if (field === "pacingNote" || field === "mypYear") continue;
      if (cur[field] !== def[field]) {
        yearDiff[field] = cur[field];
        yearHasChanges = true;
      }
    }
    if (yearHasChanges) {
      timingDiff[year] = yearDiff;
      hasTimingChanges = true;
    }
  }
  if (hasTimingChanges) {
    diff.timingProfiles = timingDiff as AIModelConfig["timingProfiles"];
  }

  return diff;
}

// =========================================================================
// Grade options
// =========================================================================

export const GRADE_OPTIONS = [
  "Year 1 (Grade 6)",
  "Year 2 (Grade 7)",
  "Year 3 (Grade 8)",
  "Year 4 (Grade 9)",
  "Year 5 (Grade 10)",
];
