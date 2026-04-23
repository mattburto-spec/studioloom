/**
 * Pure helpers for the fabricator queue UI (Phase 7-3).
 *
 * Sibling `.ts` so tests don't need the `.tsx` transform — same
 * convention as `revision-history-helpers.ts`,
 * `teacher-queue-helpers.ts`, etc.
 */

/**
 * Short binary file-size formatter — "1.2 MB", "340 KB", "12 B".
 * Lab techs like seeing file size at a glance so they can tell
 * "tiny test cube" from "50MB whole-plate job". Returns "—" for
 * null / undefined / negative inputs so the UI doesn't render
 * "NaN B".
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    // One decimal place below 10 MB, none above — keeps the column
    // narrow without losing useful precision on small files.
    return mb < 10 ? `${mb.toFixed(1)} MB` : `${mb.toFixed(0)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

/**
 * Display label for a machine_category enum. The DB stores the
 * underscore form; this returns a human-readable capitalised
 * phrase for row subtitles.
 */
export function machineCategoryLabel(
  category: "3d_printer" | "laser_cutter" | null | undefined
): string {
  if (category === "3d_printer") return "3D printer";
  if (category === "laser_cutter") return "Laser cutter";
  return "Unknown";
}

export type FabQueueTab = "ready" | "in_progress";

/** Human label for a tab — used by the tab bar + empty-state copy. */
export function fabTabLabel(tab: FabQueueTab): string {
  return tab === "ready" ? "Ready to pick up" : "In progress";
}

/**
 * Empty-state copy per tab. Lab techs don't read dashboards — keep
 * it short and actionable. `hasNoAssignments` is the important
 * edge case (fabricator invited but no machines assigned yet).
 */
export function fabEmptyMessage(
  tab: FabQueueTab,
  hasNoAssignments: boolean
): string {
  if (hasNoAssignments) {
    return "No machines assigned to you yet. Ask your teacher to assign you to a machine via the Fabricators admin page.";
  }
  return tab === "ready"
    ? "No approved jobs waiting to be picked up right now."
    : "You don't have any jobs in progress right now.";
}
