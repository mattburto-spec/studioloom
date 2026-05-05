/**
 * TG.0C.4 — pure form-state reducer for QuickCheckRow.
 *
 * Extracted to a sibling .ts so vitest tests can import it without crossing
 * the JSX boundary (Lesson #71). The QuickCheckRow.tsx imports + dispatches
 * against this reducer.
 *
 * Architecture per brief Q2 (Matt confirmed default — single-select for v1):
 *   Quick-Check covers ONE criterion. Multi-select can land later by
 *   flipping the formState shape from `criterion: NeutralCriterionKey | null`
 *   to `criteria: Set<NeutralCriterionKey>`. Server-side already supports
 *   multi (one row per criterion in task_criterion_weights).
 */

import type { NeutralCriterionKey } from "@/lib/pipeline/stages/stage4-neutral-validator";
import type { CreateTaskInput } from "@/lib/tasks/types";

export interface LinkedPage {
  unit_id: string;
  page_id: string;
}

export interface QuickCheckFormState {
  title: string;
  criterion: NeutralCriterionKey | null;
  dueDate: string; // ISO YYYY-MM-DD or "" for unset
  linkedPages: LinkedPage[];
}

export const INITIAL_FORM_STATE: QuickCheckFormState = {
  title: "",
  criterion: null,
  dueDate: "",
  linkedPages: [],
};

// ─── Actions ─────────────────────────────────────────────────────────────────

export type QuickCheckAction =
  | { type: "setTitle"; title: string }
  | { type: "setCriterion"; criterion: NeutralCriterionKey | null }
  | { type: "setDueDate"; dueDate: string }
  | { type: "togglePage"; page: LinkedPage }
  | { type: "reset" };

export function quickCheckReducer(
  state: QuickCheckFormState,
  action: QuickCheckAction
): QuickCheckFormState {
  switch (action.type) {
    case "setTitle":
      return { ...state, title: action.title };
    case "setCriterion":
      return { ...state, criterion: action.criterion };
    case "setDueDate":
      return { ...state, dueDate: action.dueDate };
    case "togglePage": {
      const exists = state.linkedPages.some(
        (p) =>
          p.unit_id === action.page.unit_id &&
          p.page_id === action.page.page_id
      );
      const linkedPages = exists
        ? state.linkedPages.filter(
            (p) =>
              !(
                p.unit_id === action.page.unit_id &&
                p.page_id === action.page.page_id
              )
          )
        : [...state.linkedPages, action.page];
      return { ...state, linkedPages };
    }
    case "reset":
      return INITIAL_FORM_STATE;
    default: {
      // Exhaustiveness check
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

// ─── Validators / formatters ─────────────────────────────────────────────────

export interface QuickCheckValidationError {
  field: "title" | "criterion";
  message: string;
}

/**
 * Form-level validation. The server-side validator covers the full payload
 * shape; this client-side check only catches the two REQUIRED fields so the
 * Save button can be reactively enabled/disabled.
 */
export function validateQuickCheckForm(
  state: QuickCheckFormState
): QuickCheckValidationError[] {
  const errors: QuickCheckValidationError[] = [];
  if (state.title.trim().length === 0) {
    errors.push({ field: "title", message: "Title is required" });
  }
  if (state.title.length > 200) {
    errors.push({ field: "title", message: "Title must be 200 chars or fewer" });
  }
  if (state.criterion === null) {
    errors.push({ field: "criterion", message: "Pick one criterion" });
  }
  return errors;
}

export function isQuickCheckFormReady(state: QuickCheckFormState): boolean {
  return validateQuickCheckForm(state).length === 0;
}

// ─── Payload builder ─────────────────────────────────────────────────────────

/**
 * Build the CreateTaskInput payload from a complete form state. Caller MUST
 * have validated the state first (isQuickCheckFormReady) — this throws if
 * required fields are missing.
 */
export function buildCreateInput(
  state: QuickCheckFormState,
  unitId: string,
  classId: string | null = null
): CreateTaskInput {
  if (!isQuickCheckFormReady(state)) {
    throw new Error(
      "buildCreateInput called on incomplete form state — call validateQuickCheckForm first"
    );
  }

  // After the `isQuickCheckFormReady` gate, criterion is non-null.
  const criterion = state.criterion as NeutralCriterionKey;

  return {
    unit_id: unitId,
    class_id: classId,
    title: state.title.trim(),
    task_type: "formative",
    status: "draft",
    config: {
      criteria: [criterion],
      due_date: state.dueDate || undefined,
      linked_pages:
        state.linkedPages.length > 0 ? state.linkedPages : undefined,
    },
    criteria: [{ key: criterion, weight: 100 }],
    linked_pages:
      state.linkedPages.length > 0 ? state.linkedPages : undefined,
  };
}
