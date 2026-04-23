/**
 * Pure helpers for the LabTechCompletionCard (Phase 7-4).
 *
 * Sibling `.ts` so tests don't need the `.tsx` transform —
 * same convention as teacher-review-note-helpers.ts.
 */

/**
 * Should we render the LabTechCompletionCard for this job state?
 *
 * True when the lab tech has actioned the job (completed or failed).
 * The card is the ONLY thing the student sees post-completion —
 * ScanResultsViewer is hidden because the fabrication run is done,
 * rules are no longer actionable.
 */
export function shouldShowCompletionCard(jobStatus: string): boolean {
  return jobStatus === "completed";
}

/**
 * Mirror of shouldHideSubmitButton from Phase 6-6c but for
 * post-completion. When a job is `completed`, hide the scan-results
 * viewer entirely — the lab-tech verdict has replaced the
 * student-facing action. Parallel to how `rejected` hides the
 * viewer in Phase 6-5.
 */
export function shouldHideScanViewerForCompletion(
  jobStatus: string
): boolean {
  return jobStatus === "completed";
}

export type CompletionVariant = "success" | "failure" | "unknown";

/**
 * Resolve a completion_status enum to a UI variant. Used by the
 * page + the card to branch consistently.
 */
export function completionVariantFor(
  completionStatus: string | null | undefined
): CompletionVariant {
  if (completionStatus === "failed") return "failure";
  if (completionStatus === "printed" || completionStatus === "cut") {
    return "success";
  }
  return "unknown";
}
