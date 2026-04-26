/**
 * Shared SVG icons for machine categories.
 *
 * Heroicons outline 24x24, stroke 1.75, currentColor — match the
 * convention already used elsewhere in the fabrication UI (workflow
 * card, machine edit modal). Centralised here so brand identity stays
 * consistent across:
 *   - ApprovalWorkflowCard (lab-setup)
 *   - MachineEditModal segmented category buttons
 *   - MachineCategoryPicker (student /fabrication/new — Phase 8.1d-10)
 *
 * `iconForCategory(category)` returns the right component. New
 * categories (vinyl cutter, CNC mill, etc. — see PH8-FU-HIERARCHICAL-MACHINE-PICKER)
 * just slot in here.
 */

import * as React from "react";

export function PrinterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      stroke="currentColor"
      className="w-full h-full"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
      />
    </svg>
  );
}

export function LaserIcon() {
  // Heroicons FireIcon — apt visual for laser cutter (heat / focused
  // energy). The flame outline reads as "this cuts through material"
  // without being literally a laser beam.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      stroke="currentColor"
      className="w-full h-full"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
      />
    </svg>
  );
}

/**
 * Lookup helper. Returns null for unknown categories so callers can
 * fall back to a generic icon or hide the visual.
 */
export function iconForCategory(
  category: string
): React.ReactNode | null {
  switch (category) {
    case "3d_printer":
      return <PrinterIcon />;
    case "laser_cutter":
      return <LaserIcon />;
    default:
      return null;
  }
}

/**
 * Display label for a category. Sentence-case, no jargon.
 */
export function labelForCategory(category: string): string {
  switch (category) {
    case "3d_printer":
      return "3D printer";
    case "laser_cutter":
      return "Laser cutter";
    default:
      return category;
  }
}
