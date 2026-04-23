/**
 * Canned lab-tech notes for Mark Complete + Mark Failed modals
 * (Phase 7-4). Same pattern as `canned-teacher-notes.ts` (6-6l) —
 * chip → appends into the textarea on click, lab tech edits + confirms.
 *
 * Keep entries short + action-ish. Lab techs log outcomes in 10
 * seconds, not compose essays. "Warped off the bed" + a layer
 * number is more useful than a paragraph.
 *
 * Future (PH7-FU-FABRICATOR-CANNED-NOTES P3): let fabricators
 * manage their own preset list via /fab/settings. v1 hardcoded
 * defaults here cover the ~80% case.
 */

export const FAB_CANNED_NOTES: {
  complete: string[];
  fail: string[];
} = {
  complete: [
    "Printed fine — collect from the fabrication area.",
    "Cut clean — collect from the fabrication area.",
    "Looks great — slight stringing but well within tolerance.",
    "Completed successfully. Please double-check before handing in.",
  ],
  fail: [
    "Warped off the bed partway through. Needs a brim / better bed adhesion.",
    "Layers separated (delamination). Check the slicer's wall thickness + temp.",
    "Didn't cut all the way through — material too thick for this machine.",
    "File wouldn't open / slice cleanly. Re-export and try again.",
    "Needs support structures that aren't enabled in the file.",
    "Machine error during the run. Not related to the file — you can re-submit.",
  ],
};

export type FabCannedNoteKind = keyof typeof FAB_CANNED_NOTES;

export function fabCannedNotesForAction(
  actionKind: "complete" | "fail"
): string[] {
  return FAB_CANNED_NOTES[actionKind];
}

/**
 * Same append-if-non-empty behaviour as the teacher equivalent.
 * Extracted here rather than shared so teacher + fab preset
 * systems can evolve independently.
 */
export function insertFabCannedNote(current: string, preset: string): string {
  const trimmed = current.trim();
  if (trimmed.length === 0) return preset;
  return `${trimmed}\n\n${preset}`;
}
