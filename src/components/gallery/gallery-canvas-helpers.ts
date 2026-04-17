/**
 * Pure helpers for GalleryCanvasView — kept in a non-tsx module so unit
 * tests can import them without needing a DOM/JSX transform environment.
 *
 * Spec: docs/projects/gallery-v2.md §10 GV2-1
 */

export interface CanvasSubmission {
  id: string;
  studentId: string;
  studentName: string | null;
  contextNote: string | null;
  canvasX: number | null;
  canvasY: number | null;
}

export interface CanvasLayoutChange {
  submissionId: string;
  x: number;
  y: number;
}

// Card + layout constants
export const CARD_WIDTH = 240;
export const CARD_HEIGHT = 180;
export const CARD_GAP = 24;
export const AUTO_LAYOUT_STEP = CARD_WIDTH + CARD_GAP + 20; // 284
export const AUTO_LAYOUT_ROW_STEP = CARD_HEIGHT + CARD_GAP + 20; // 224
export const AUTO_LAYOUT_COLS = 4;
export const DEBOUNCE_MS = 600;

/**
 * Returns the (x, y) for a submission. If canvas position is null on either
 * axis, auto-layouts in a 4-column grid by index.
 */
export function resolvePosition(
  submission: CanvasSubmission,
  index: number
): { x: number; y: number } {
  if (submission.canvasX !== null && submission.canvasY !== null) {
    return { x: submission.canvasX, y: submission.canvasY };
  }
  const col = index % AUTO_LAYOUT_COLS;
  const row = Math.floor(index / AUTO_LAYOUT_COLS);
  return { x: col * AUTO_LAYOUT_STEP, y: row * AUTO_LAYOUT_ROW_STEP };
}

/**
 * Anonymous mode hides real names ("Classmate 1", "Classmate 2", ...).
 * Named mode uses studentName; falls back to bare "Classmate" when null.
 */
export function displayName(
  submission: CanvasSubmission,
  index: number,
  anonymous: boolean
): string {
  if (anonymous) return `Classmate ${index + 1}`;
  return submission.studentName || "Classmate";
}
