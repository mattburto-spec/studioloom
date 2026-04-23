/**
 * Canned teacher-note presets (Phase 6-6l).
 *
 * Shipped as hardcoded chips inside the TeacherActionBar modal so a
 * teacher triaging a queue of 15+ submissions can insert a common
 * reason in one click + lightly edit rather than retyping the same
 * sentence. Organised per action because the tone differs:
 *
 *   return  — "fix these + re-upload" messages (actionable, directive)
 *   reject  — "start over / talk to me" messages (terminal, firm but kind)
 *   approve — "nice work" variants + lab-tech-handoff notes
 *   note    — general comments with no status transition
 *
 * Future (PH6-FU-TEACHER-CANNED-NOTES-EDITABLE P3): surface a
 * management UI at /teacher/preflight/settings so teachers can tune
 * the list to their own phrasing. Stored per-teacher in a new table
 * (or `teachers.canned_notes` JSONB if the shape stays flat). For
 * v1, these defaults cover the ~80% case — pilot feedback will tell
 * us which presets are under/over-used.
 *
 * Keep entries ~1 short sentence. Teachers will edit after insert,
 * so presets are STARTERS not final text. Avoid anything that
 * presumes the student's specific rule hits — those come from the
 * ScanResultsViewer context, not this list.
 */

export const CANNED_NOTES: {
  return: string[];
  reject: string[];
  approve: string[];
  note: string[];
} = {
  return: [
    "Please acknowledge each should-fix warning and re-upload — the scanner is flagging things you should know about.",
    "The walls/features are too thin to fabricate reliably. Thicken to the machine's minimum (check the rule card for the exact number) and re-upload.",
    "Part of this design is outside the machine's build area. Scale it down or rearrange the layout and re-upload.",
    "The cut spacing is too tight for our kerf. Widen cut lines to at least 0.5 mm apart and re-upload.",
    "Please add your name or initials somewhere on the design so the lab tech can identify your file.",
    "This file looks like an early iteration. Please finish the design (sketches + refinement) before the fabrication step.",
    "The file type doesn't match the machine you picked. Re-upload in the correct format (SVG for laser, STL for 3D).",
  ],
  reject: [
    "This doesn't match the assignment brief. Review the unit criteria and start a fresh submission when you're ready.",
    "This design isn't ready for fabrication — please complete the sketch + prototype stages first.",
    "Safety concern with this design. Come and talk to me in class before you submit anything for this project.",
    "Content isn't appropriate for school fabrication. Please submit a design that fits our workshop guidelines.",
    "This looks like a test upload / stock file. Please submit your own work.",
    "Too many must-fix issues in the file — easier to start fresh than revise. New submission when ready.",
  ],
  approve: [
    "Great work — approved!",
    "Nice iteration. Cleared for fabrication.",
    "Approved. Check in with the lab tech about material settings before the machine runs.",
    "Looks good. Please collect from the fabrication area within a week.",
  ],
  note: [
    "I've left a comment here — please read and update your work when you can.",
    "Quick question about your design — come and chat with me in class.",
    "Nice progress. One thing to think about before resubmitting…",
  ],
};

/**
 * Keys into CANNED_NOTES — same shape as ActiveModal's action kind
 * in TeacherActionBar (minus "approve-note" which shares the
 * "approve" preset list).
 */
export type CannedNoteKind = keyof typeof CANNED_NOTES;

/**
 * Resolve the modal action kind (as used by TeacherActionBar) to the
 * CANNED_NOTES key. `approve-note` falls back to the `approve`
 * presets — same tone, just an optional rather than required note.
 */
export function cannedNotesForAction(
  actionKind: "return" | "reject" | "note" | "approve-note"
): string[] {
  switch (actionKind) {
    case "return":
      return CANNED_NOTES.return;
    case "reject":
      return CANNED_NOTES.reject;
    case "note":
      return CANNED_NOTES.note;
    case "approve-note":
      return CANNED_NOTES.approve;
  }
}

/**
 * Given the current textarea contents + a preset to insert, return
 * the new textarea contents. Rule: empty textarea → replace;
 * non-empty → append with a blank line separator. Teachers can
 * always hand-edit afterwards. Never strips what's already there.
 */
export function insertCannedNote(current: string, preset: string): string {
  const trimmed = current.trim();
  if (trimmed.length === 0) return preset;
  return `${trimmed}\n\n${preset}`;
}
