/**
 * TG.0C.3 — pure types + display helpers for TasksPanel.
 *
 * Extracted from TasksPanel.tsx so vitest tests (which can't load JSX in
 * this repo's config — Lesson #71) can import the formatter without
 * pulling React.
 */

import type { AssessmentTask } from "@/lib/tasks/types";
import type { NeutralCriterionKey } from "@/lib/pipeline/stages/stage4-neutral-validator";
import type { FrameworkId } from "@/lib/frameworks/adapter";

export interface TaskRowDisplay {
  id: string;
  /** "⚡" for formative, "🎯" for summative */
  icon: string;
  title: string;
  /** Comma-joined criterion short labels (framework-aware), e.g. "A, B" or "AO1" */
  criterionLine: string;
  /** Human-friendly date or empty string ("Mon 12 May" / "" if no due date) */
  dueLine: string;
  /** Status pill text — empty for draft, "Published" / "Closed" otherwise */
  statusBadge: string;
  /** True if the task is summative — used for [Configure →] hint */
  isSummative: boolean;
}

const ICON_BY_TYPE: Record<AssessmentTask["task_type"], string> = {
  formative: "⚡",
  summative: "🎯",
  peer: "👥",
  self: "🪞",
};

/**
 * Format a date string (ISO YYYY-MM-DD) to a compact display form.
 * Returns "" for missing / invalid input.
 *
 * Output format: "Mon 12 May" — short weekday + day + short month.
 * Locale-independent (uses fixed English short forms) so tests are
 * deterministic without timezone wobble.
 */
export function formatDueDate(iso: string | undefined | null): string {
  if (!iso || typeof iso !== "string") return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";

  const [y, m, d] = iso.split("-").map(Number);
  // Construct in UTC to avoid timezone drift on the day-of-week
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return "";

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${weekdays[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

/**
 * Render a comma-separated list of criterion keys using framework labels.
 * Falls back to neutral keys if labelByKey can't resolve one.
 */
export function formatCriterionLine(
  keys: readonly NeutralCriterionKey[],
  labelByKey: Map<NeutralCriterionKey, string>
): string {
  if (keys.length === 0) return "";
  return keys.map((k) => labelByKey.get(k) ?? k).join(", ");
}

/**
 * Pull a formative task's due_date out of config without leaking config-shape
 * details into the React component. Returns "" for non-formative or missing.
 */
export function extractDueDate(task: AssessmentTask): string {
  const config = task.config as Record<string, unknown>;
  const due = config?.due_date;
  return typeof due === "string" ? due : "";
}

/**
 * Compute the row display shape for a single task. Pure function — testable
 * without React. Per Lesson #38, callers assert against this output rather
 * than rendering and walking the DOM.
 */
export function formatTaskRow(
  task: AssessmentTask,
  labelByKey: Map<NeutralCriterionKey, string>
): TaskRowDisplay {
  const isSummative = task.task_type === "summative";
  const statusBadge =
    task.status === "draft"
      ? ""
      : task.status === "published"
        ? "Published"
        : "Closed";

  return {
    id: task.id,
    icon: ICON_BY_TYPE[task.task_type] ?? "📋",
    title: task.title,
    criterionLine: formatCriterionLine(task.criteria, labelByKey),
    dueLine: formatDueDate(extractDueDate(task)),
    statusBadge,
    isSummative,
  };
}

/**
 * Build a Map<NeutralCriterionKey, shortLabel> for a given framework using
 * the FrameworkAdapter. This is the lookup table the panel uses to render
 * "A, B" instead of "researching, designing".
 *
 * Each FrameworkMapping has criteria[].neutralKeys (one short label can map
 * to multiple neutral keys). We invert that mapping here.
 */
export function buildCriterionLabelMap(
  framework: FrameworkId,
  criterionDefs: ReadonlyArray<{
    short: string;
    neutralKeys: readonly NeutralCriterionKey[];
  }>
): Map<NeutralCriterionKey, string> {
  const map = new Map<NeutralCriterionKey, string>();
  for (const def of criterionDefs) {
    for (const k of def.neutralKeys) {
      map.set(k, def.short);
    }
  }
  // framework param kept for future per-framework overrides; unused for now
  void framework;
  return map;
}
