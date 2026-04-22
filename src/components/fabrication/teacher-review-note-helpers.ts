/**
 * Pure helpers for TeacherReviewNoteCard (Phase 6-5).
 *
 * Extracted into a sibling `.ts` so tests don't need the `.tsx`
 * transform (same convention as `rule-card-helpers.ts`,
 * `revision-history-helpers.ts`, `teacher-queue-helpers.ts`).
 */

export type TeacherReviewVariant =
  | "needs_revision"
  | "rejected"
  | "approved"
  | "none";

export interface TeacherReviewStyle {
  /** One of the 4 variants driving card tint + heading. */
  variant: TeacherReviewVariant;
  /** Tailwind classes for the outer card border + bg tint. */
  cardClass: string;
  /** Tailwind classes for the heading text colour. */
  headingClass: string;
  /** Heading text shown at the top of the card. */
  heading: string;
  /** Copy rendered below the note (or above, if no note). Explains
   *  what the student should do next. */
  hint: string;
  /** Whether to show a "Start fresh" CTA (rejected only — student
   *  can't re-use this job, has to upload a new one). */
  showStartFreshCta: boolean;
}

/**
 * Variant selector — maps `fabrication_jobs.status` to the card style
 * the student sees on `/fabrication/jobs/[jobId]`.
 *
 * `needs_revision` → amber, interactive (viewer + re-upload visible)
 * `rejected`       → red, read-only, "Start fresh" link
 * `approved`       → green info card (informational; student usually
 *                    already on the submitted stub page, but may
 *                    hard-navigate back and we should show useful
 *                    state not the pre-submit "ready to submit" UI)
 * everything else  → `none` — caller skips the card entirely
 */
export function teacherReviewStyleFor(jobStatus: string): TeacherReviewStyle {
  switch (jobStatus) {
    case "needs_revision":
      return {
        variant: "needs_revision",
        cardClass: "border-amber-300 bg-amber-50",
        headingClass: "text-amber-900",
        heading: "Your teacher has asked for a revision",
        hint: "Read your teacher's note below, then re-upload a fixed version of your file.",
        showStartFreshCta: false,
      };
    case "rejected":
      return {
        variant: "rejected",
        cardClass: "border-red-300 bg-red-50",
        headingClass: "text-red-900",
        heading: "Your teacher rejected this submission",
        hint: "This job is closed. Start a fresh submission if you want to try again with a different approach.",
        showStartFreshCta: true,
      };
    case "approved":
      return {
        variant: "approved",
        cardClass: "border-green-300 bg-green-50",
        headingClass: "text-green-900",
        heading: "Your teacher approved this submission",
        hint: "Your file is cleared to fabricate. The lab tech will pick it up from here.",
        showStartFreshCta: false,
      };
    default:
      return {
        variant: "none",
        cardClass: "",
        headingClass: "",
        heading: "",
        hint: "",
        showStartFreshCta: false,
      };
  }
}

/**
 * True when the student can still interact (acknowledge warnings,
 * re-upload) on this job's status page — false when the job is
 * terminally closed from the student's perspective.
 *
 * `rejected` is the only "end of road" status for v1. `approved` /
 * `completed` / `picked_up` are ALSO terminal but already send the
 * student to the submitted stub page; a student who hard-navigates
 * back shouldn't be able to acknowledge warnings on an approved job
 * either, so we lock those down the same way.
 */
export function studentActionsLocked(jobStatus: string): boolean {
  return (
    jobStatus === "rejected" ||
    jobStatus === "approved" ||
    jobStatus === "completed" ||
    jobStatus === "picked_up" ||
    jobStatus === "cancelled"
  );
}

/**
 * Format the teacher-reviewed-at ISO timestamp as a "reviewed 3h ago"
 * footer. Returns null for null/invalid inputs — the UI just omits
 * the footer rather than rendering something ugly.
 */
export function formatReviewedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diffMs = Math.max(0, Date.now() - t);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "reviewed just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `reviewed ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `reviewed ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `reviewed ${diffDay}d ago`;
}

/**
 * True when the review card should render at all. Keeps the decision
 * in one place so both the helper-tests and the component agree.
 */
export function shouldShowReviewCard(
  jobStatus: string,
  teacherNote: string | null
): boolean {
  // Always show for the 3 actioned statuses. Even with no note,
  // students need to see that their teacher touched the job — the
  // absence of a note is still meaningful on `rejected` (silent
  // rejection) or `approved` (quick thumbs-up).
  const variant = teacherReviewStyleFor(jobStatus).variant;
  if (variant === "needs_revision" || variant === "rejected" || variant === "approved") {
    return true;
  }
  // Edge case: teacher added a note on a pending_approval job via
  // the "note" endpoint without transitioning status. Show a neutral
  // info card so the student sees the feedback. We handle this by
  // falling back to the `approved` card style — same green tint is
  // still misleading, so we return false and let Phase 9 add a
  // neutral "note" variant. For v1, notes without a transition are
  // invisible to students.
  void teacherNote; // intentionally unused for v1
  return false;
}
