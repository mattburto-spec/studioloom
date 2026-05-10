export type Criterion = "DO" | "NOTICE" | "DECIDE" | "NEXT";

export type MultiQuestionField = {
  id: string;
  /** Question heading. The trailing "?" is colored by the criterion accent (or brand purple when criterion is undefined). */
  label: string;
  /** Helper sentence shown beneath the heading. */
  helper?: string;
  /** Textarea placeholder. */
  placeholder?: string;
  /** Soft "good answer" length — the ring fills to here, then turns green. */
  target: number;
  /** Hard cap. The textarea blocks input past this. */
  max: number;
  /**
   * LIS.C — criterion is now optional. Drives accent color, badge tone,
   * ring color, etc. when set. When undefined, the field falls back to
   * the brand-purple neutral palette and the StepStrip label drops the
   * criterion prefix (showing "01" instead of "01 · DO").
   */
  criterion?: Criterion;
  /** Sentence-starter chips below the textarea. */
  starters?: string[];
};

export type MultiQuestionValues = Record<string, string>;

/** Shared color map used across stepper, badge, ring, chip, button. */
export const CRITERION_COLOR: Record<Criterion, string> = {
  DO: "var(--sl-accent-orange)",
  NOTICE: "var(--sl-accent-blue)",
  DECIDE: "var(--sl-accent-green)",
  NEXT: "var(--sl-accent-purple)",
};

/** Same as above but as raw hex — needed for places where var() can't reach
 *  (inline SVG stroke attributes, alpha tints via rgba()). */
export const CRITERION_HEX: Record<Criterion, string> = {
  DO: "#E86F2C",
  NOTICE: "#2E86AB",
  DECIDE: "#2DA05E",
  NEXT: "#8B2FC9",
};

/** Fallback colors when a field has no criterion (LIS.C — opt-in stepper for
 *  generic structured-prompts that aren't tagged with DO/NOTICE/DECIDE/NEXT). */
export const NEUTRAL_COLOR = "var(--sl-primary)";
export const NEUTRAL_HEX = "#9333EA";

/** Resolve the criterion color for a field. Returns brand-purple when criterion is undefined. */
export function fieldColor(criterion: Criterion | undefined): string {
  return criterion ? CRITERION_COLOR[criterion] : NEUTRAL_COLOR;
}

export function fieldHex(criterion: Criterion | undefined): string {
  return criterion ? CRITERION_HEX[criterion] : NEUTRAL_HEX;
}
