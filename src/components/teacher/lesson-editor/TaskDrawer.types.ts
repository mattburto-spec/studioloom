/**
 * TG.0D.3 — pure types + helpers for TaskDrawer + TaskDrawerTabNav.
 *
 * Extracted to .ts so vitest tests can import without crossing the JSX
 * boundary (Lesson #71). The drawer + tab nav .tsx files re-render based
 * on the descriptor list this builds.
 */

import {
  SUMMATIVE_TAB_LABELS,
  SUMMATIVE_TAB_ORDER,
  type SummativeTabId,
} from "./summative-form-state";

/**
 * One row in the tab nav strip. Drives the rendered output:
 *   "1. GRASPS" + optional red badge "(3)" + isActive styling
 */
export interface TabNavDescriptor {
  /** 1-indexed tab number for display ("1.", "2.", etc) */
  number: number;
  /** Tab id — discriminator + data-testid value */
  id: SummativeTabId;
  /** Human label, e.g. "GRASPS" */
  label: string;
  /** Active flag — only one tab is active at a time */
  isActive: boolean;
  /** Error count for the badge. 0 means no badge rendered. */
  errorCount: number;
}

/**
 * Build the descriptor list from the current activeTab + per-tab error
 * counts. Drives both the visual order and the badge math.
 *
 * Order is fixed: GRASPS (1) → Submission (2) → Rubric (3) → Timeline (4) → Policy (5).
 * The order is part of the contract — Tab 1 GRASPS first is the
 * backward-design forcing function (Tasks v1 Friction Moment 03).
 */
export function buildTabNavDescriptors(
  activeTab: SummativeTabId,
  errorCountsByTab: Record<SummativeTabId, number>
): TabNavDescriptor[] {
  return SUMMATIVE_TAB_ORDER.map((id, idx) => ({
    number: idx + 1,
    id,
    label: SUMMATIVE_TAB_LABELS[id],
    isActive: id === activeTab,
    errorCount: errorCountsByTab[id] ?? 0,
  }));
}

/**
 * Compose the visible label for a tab: "1. GRASPS" or "1. GRASPS (3)" if
 * there are errors. Pure — no React.
 */
export function formatTabLabel(d: TabNavDescriptor): string {
  if (d.errorCount > 0) {
    return `${d.number}. ${d.label} (${d.errorCount})`;
  }
  return `${d.number}. ${d.label}`;
}

// ─── Drawer-level helpers ───────────────────────────────────────────────────

/**
 * Cheap dirty check — JSON.stringify both sides. State is small (~30 fields)
 * so this is fine for an effect-level dirty flag. Used by TaskDrawer to
 * gate the unsaved-changes confirm on close.
 */
export function isFormStateDirty<T>(current: T, initial: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial);
}
