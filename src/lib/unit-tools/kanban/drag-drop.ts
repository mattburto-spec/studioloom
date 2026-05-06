/**
 * Pure logic for Kanban drag-drop hit testing + drop classification.
 *
 * Round 19 (6 May 2026) — drag-and-drop between columns. Per Lesson
 * #71, anything that can run without React lives in a `.ts` so tests
 * import it directly.
 *
 * The flow is:
 *   1. Student drags a card. Framer Motion captures the pointer.
 *   2. On drag end, we get the final pointer coordinates.
 *   3. findDropTargetColumn() scans the registered column rects to
 *      find which column (if any) is under the pointer.
 *   4. classifyDrop() decides what should happen:
 *        - "noop"          → same column, snap back, no dispatch
 *        - "ok"            → clean cross-column move (no extra args)
 *        - "needsModal"    → move would require DoD / estimate /
 *                            because — open the modal in move-to mode
 *                            so the student can fill in the missing
 *                            fields before confirming
 *        - "blocked"       → WIP limit would be exceeded — snap back,
 *                            show toast
 *
 * Validation reuses validateMove from the reducer so drag drop and
 * the modal flow share one source of truth.
 */

import type {
  KanbanCard,
  KanbanColumn as KanbanColumnId,
  KanbanState,
} from "./types";
import { validateMove } from "./reducer";

/** Bounding rect for a column, captured at drag start. */
export interface ColumnRect {
  columnId: KanbanColumnId;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Returns the columnId whose rect contains (x, y), or null if no
 * column matches. Pure — caller passes already-captured rects so
 * tests don't need a DOM.
 */
export function findDropTargetColumn(
  point: { x: number; y: number },
  rects: ColumnRect[]
): KanbanColumnId | null {
  for (const rect of rects) {
    if (
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    ) {
      return rect.columnId;
    }
  }
  return null;
}

/** Drop classification — drives KanbanBoard's drag-end handler. */
export type DropAction =
  | { kind: "noop" }
  | { kind: "ok"; toStatus: KanbanColumnId }
  | { kind: "needsModal"; toStatus: KanbanColumnId; missingFields: string[] }
  | { kind: "blocked"; reason: string };

/**
 * Decide what should happen when a card is dropped on a target column.
 * Wraps validateMove + maps the validation errors into:
 *   - "blocked" for WIP-cap violations (these can't be fixed by
 *     filling fields; the student has to finish current Doing first)
 *   - "needsModal" for DoD / because-clause errors (these are
 *     fixable in the modal's move-to flow)
 *   - "ok" when validateMove passes
 */
export function classifyDrop(
  state: KanbanState,
  card: KanbanCard,
  toStatus: KanbanColumnId | null
): DropAction {
  if (toStatus === null) return { kind: "noop" };
  if (toStatus === card.status) return { kind: "noop" };

  const validation = validateMove(state, card.id, toStatus, {
    estimateMinutes: card.estimateMinutes,
    becauseClause: card.becauseClause ?? undefined,
  });

  if (validation.ok) {
    return { kind: "ok", toStatus };
  }

  // WIP errors are not fixable in the modal — student must free a slot first.
  const wipErr = validation.errors.find((e) => e.field === "wip");
  if (wipErr) {
    return { kind: "blocked", reason: wipErr.message };
  }

  // DoD / because errors → open modal pre-set on target column so the
  // student can fill them in then confirm.
  const fixableFields = validation.errors.map((e) => e.field);
  return {
    kind: "needsModal",
    toStatus,
    missingFields: fixableFields,
  };
}
