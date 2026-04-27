"use client";

/**
 * /fabrication/jobs/[jobId] — Preflight Phase 5-4 status + results page.
 * (File path uses the `(student)` route group — URL is /fabrication/jobs/X,
 * NOT /student/fabrication/jobs/X. PH4-FINDING-01.)
 *
 * Flow:
 *   1. Polls /api/student/fabrication/jobs/[jobId]/status?include=results
 *      via useFabricationStatus hook (Phase 4-5, extended 5-4).
 *   2. While scan is pending/running → renders ScanProgressCard
 *      (Phase 4-5 staged-messaging spinner).
 *   3. On scan_status === 'done' → delegates to ScanResultsViewer
 *      (Phase 5-3) for the 3-bucket soft-gate UI.
 *   4. On scan_status === 'error' OR polling error → renders error card
 *      via ScanProgressCard's error state (untouched).
 *   5. On 90s timeout → ScanProgressCard's timeout state.
 *
 * User actions from the results viewer:
 *   - onAcknowledge(ruleId, choice) → POST /acknowledge-warning, update
 *     local ack state optimistically.
 *   - onSubmit() → POST /submit, router.push /fabrication/submitted/[jobId]
 *     on success (submitted stub page lands in Phase 5-6).
 *   - onReupload() → stub for Phase 5-5 (ReuploadModal). For now, simple
 *     inline redirect to /fabrication/new — user loses the jobId context
 *     but the flow still works end-to-end for the Checkpoint 5.1 smoke.
 */

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useFabricationStatus } from "@/hooks/useFabricationStatus";
import { ScanProgressCard } from "@/components/fabrication/ScanProgressCard";
import { ScanResultsViewer } from "@/components/fabrication/ScanResultsViewer";
import { RevisionHistoryPanel } from "@/components/fabrication/RevisionHistoryPanel";
import { ReuploadModal } from "@/components/fabrication/ReuploadModal";
import { TeacherReviewNoteCard } from "@/components/fabrication/TeacherReviewNoteCard";
import { PreviewCard } from "@/components/fabrication/PreviewCard";
import {
  shouldShowReviewCard,
  studentActionsLocked,
  shouldHideSubmitButton,
  canWithdrawJob,
  canDeleteJob,
} from "@/components/fabrication/teacher-review-note-helpers";
import { LabTechCompletionCard } from "@/components/fabrication/LabTechCompletionCard";
import {
  shouldShowCompletionCard,
  shouldHideScanViewerForCompletion,
} from "@/components/fabrication/lab-tech-completion-helpers";
import { canSubmit, type Rule } from "@/lib/fabrication/rule-buckets";
import type {
  AckChoice,
  AcknowledgedWarnings,
  JobStatusSuccess,
  RevisionSummary,
} from "@/lib/fabrication/orchestration";
import type { FabricationFileType } from "@/components/fabrication/picker-helpers";

export default function FabricationJobStatusPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params?.jobId;

  const { state: pollState, reset: resetPoll } = useFabricationStatus(
    jobId ?? "",
    { includeResults: true }
  );

  // Local ack state — mirrors server-side acknowledged_warnings but
  // allows optimistic updates when the student clicks a radio. Hydrated
  // from the first poll response that carries acknowledged_warnings;
  // subsequent polls don't overwrite (student's in-flight clicks win).
  const [localAcks, setLocalAcks] = React.useState<AcknowledgedWarnings>({});
  const hydratedFromServerRef = React.useRef(false);

  React.useEffect(() => {
    if (hydratedFromServerRef.current) return;
    if (pollState.kind !== "polling" && pollState.kind !== "done") return;
    const serverAcks = (pollState.status as JobStatusSuccess).acknowledgedWarnings;
    if (serverAcks !== undefined) {
      // Server types `choice` as a loose string for forward-compat
      // (manual SQL edits, migrations adding new choices, etc). Local
      // state trusts the DB shape — if the choice doesn't match any
      // AckChoice, the radio renders with no selection (graceful
      // degrade, no crash).
      setLocalAcks((serverAcks ?? {}) as AcknowledgedWarnings);
      hydratedFromServerRef.current = true;
    }
  }, [pollState]);

  const [isAckInFlight, setIsAckInFlight] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Phase 5-5: revision history panel + re-upload modal state.
  const [revisions, setRevisions] = React.useState<RevisionSummary[]>([]);
  const [revisionsError, setRevisionsError] = React.useState<string | null>(null);
  const [isReuploadOpen, setIsReuploadOpen] = React.useState(false);

  // Fetch revisions list once on jobId mount. Re-fetched after a
  // successful re-upload so the new revision appears in the history.
  const fetchRevisions = React.useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(
        `/api/student/fabrication/jobs/${jobId}/revisions`,
        { credentials: "same-origin" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setRevisionsError(body.error || `Couldn't load revision history (HTTP ${res.status})`);
        return;
      }
      const body = await res.json();
      setRevisions(body.revisions ?? []);
      setRevisionsError(null);
    } catch (e) {
      setRevisionsError(e instanceof Error ? e.message : "Network error");
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  async function handleAcknowledge(ruleId: string, choice: AckChoice) {
    if (pollState.kind !== "done" || !jobId) return;
    const revisionNumber = pollState.status.currentRevision;
    const revisionKey = `revision_${revisionNumber}`;

    // Optimistic update — roll back on failure.
    const previousAcks = localAcks;
    setLocalAcks({
      ...localAcks,
      [revisionKey]: {
        ...(localAcks[revisionKey] ?? {}),
        [ruleId]: { choice, timestamp: new Date().toISOString() },
      },
    });
    setActionError(null);
    setIsAckInFlight(true);

    try {
      const res = await fetch(
        `/api/student/fabrication/jobs/${jobId}/acknowledge-warning`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionNumber, ruleId, choice }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setLocalAcks(previousAcks);
        setActionError(
          body.error || `Couldn't save acknowledgement (HTTP ${res.status})`
        );
      } else {
        const body = await res.json();
        if (body.acknowledgedWarnings) setLocalAcks(body.acknowledgedWarnings);
      }
    } catch (e) {
      setLocalAcks(previousAcks);
      setActionError(
        e instanceof Error ? e.message : "Network error saving acknowledgement"
      );
    } finally {
      setIsAckInFlight(false);
    }
  }

  async function handleSubmit() {
    if (pollState.kind !== "done" || !jobId) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/student/fabrication/jobs/${jobId}/submit`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setActionError(body.error || `Submit failed (HTTP ${res.status})`);
        setIsSubmitting(false);
        return;
      }
      // Redirect to submitted stub (Phase 5-6 lands the page).
      router.push(`/fabrication/submitted/${jobId}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error submitting");
      setIsSubmitting(false);
    }
  }

  function handleReupload() {
    setActionError(null);
    setIsReuploadOpen(true);
  }

  // Phase 6-6k — student withdraw. Inline confirm (window.confirm is
  // good enough for v1; if we need a styled modal later, build one).
  // After success, redirect to the /fabrication overview so the
  // student sees the updated state + can start fresh if they want.
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);
  async function handleWithdraw() {
    if (!jobId) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Withdraw this submission? Your teacher won't see it anymore. You can start a fresh submission afterwards."
      )
    ) {
      return;
    }
    setActionError(null);
    setIsWithdrawing(true);
    try {
      const res = await fetch(
        `/api/student/fabrication/jobs/${jobId}/cancel`,
        { method: "POST", credentials: "same-origin" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setActionError(
          body.error || `Couldn't withdraw (HTTP ${res.status})`
        );
        setIsWithdrawing(false);
        return;
      }
      router.push("/fabrication");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error withdrawing");
      setIsWithdrawing(false);
    }
  }

  // Phase 8.1d-32 — student permanent delete. Distinct from
  // withdraw: data is wiped (DB cascade + Storage). Used to clean
  // up stuck/failed/cancelled jobs the student no longer wants in
  // their overview. window.confirm matches the existing withdraw
  // pattern — student-side white theme reads fine with native
  // chrome (the fab-side dark theme is what motivated the styled
  // ConfirmActionModal yesterday).
  const [isDeleting, setIsDeleting] = React.useState(false);
  async function handleDelete() {
    if (!jobId) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Permanently delete this submission? Your file, scan results, and all revisions will be removed. This can't be undone."
      )
    ) {
      return;
    }
    setActionError(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/student/fabrication/jobs/${jobId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setActionError(
          body.error || `Couldn't delete (HTTP ${res.status})`
        );
        setIsDeleting(false);
        return;
      }
      router.push("/fabrication");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error deleting");
      setIsDeleting(false);
    }
  }

  async function handleReuploadSuccess() {
    setIsReuploadOpen(false);

    // PH5-FU-REUPLOAD-POLL-STUCK fix (Phase 6-5b): reset all local
    // state + the poll reducer BEFORE awaiting the revision-history
    // fetch. This matters because the poll hook keeps ticking every
    // 2s regardless of reducer state — the ~100-500ms fetchRevisions
    // window is exactly when a Rev N+1 POLL_SUCCESS is most likely to
    // land. Old order (await then reset) meant:
    //   (a) poll fires during await → reducer auto-unfreezes to
    //       polling/done for Rev N+1 (via Phase 6-0 fix), THEN
    //       resetPoll() wipes that state back to idle → ~2s "flash
    //       of idle" until the next poll re-transitions.
    //   (b) if resetPoll ever broke (future refactor), we'd be back
    //       to the original stuck-on-Rev-N bug.
    // New order: reducer is idle BEFORE the poll can land → single
    // clean transition idle → polling/done on the first Rev N+1
    // response. Phase 6-0's reducer auto-unfreeze stays as a
    // defensive safety net, not the primary mechanism.
    resetPoll();
    setLocalAcks({});
    hydratedFromServerRef.current = false;

    // Re-fetch the revision history so the new revision appears.
    // Any poll that lands during this await transitions the now-idle
    // reducer to polling/done for the new revision without racing.
    await fetchRevisions();
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {pollState.kind === "done"
            ? headerTitleForStatus(
                (pollState.status as JobStatusSuccess).jobStatus,
                (pollState.status as JobStatusSuccess).completionStatus ?? null
              )
            : "Checking your file"}
        </h1>
        {pollState.kind !== "done" && (
          <p className="text-base text-gray-600 mt-2">
            We&apos;re running a quick machine-readiness check before your file
            goes into the fabrication queue.
          </p>
        )}
      </header>

      {!jobId && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Missing job id — this page needs a valid URL.
          </p>
        </div>
      )}

      {jobId && pollState.kind === "done" ? (
        <DoneStateView
          pollState={pollState}
          localAcks={localAcks}
          revisions={revisions}
          revisionsError={revisionsError}
          onAcknowledge={handleAcknowledge}
          onSubmit={handleSubmit}
          onReupload={handleReupload}
          onWithdraw={handleWithdraw}
          onDelete={handleDelete}
          isAckInFlight={isAckInFlight}
          isSubmitting={isSubmitting}
          isWithdrawing={isWithdrawing}
          isDeleting={isDeleting}
          actionError={actionError}
        />
      ) : jobId ? (
        <ScanProgressCard state={pollState} />
      ) : null}

      {/* Re-upload modal — only opens when student clicks re-upload on a
          'done' state with must-fix rules (or any time they want to try
          a fresh version). */}
      {jobId && isReuploadOpen && pollState.kind === "done" && (
        <ReuploadModal
          jobId={jobId}
          originalFileType={
            (pollState.status as JobStatusSuccess).fileType as FabricationFileType
          }
          onClose={() => setIsReuploadOpen(false)}
          onSuccess={handleReuploadSuccess}
        />
      )}
    </main>
  );
}

/**
 * Header title selector — keyed on jobStatus so a student returning
 * to the page after a teacher action lands on the right framing
 * instead of a generic "Your scan is ready".
 */
function headerTitleForStatus(
  jobStatus: string,
  completionStatus?: string | null
): string {
  switch (jobStatus) {
    case "needs_revision":
      return "Revision requested";
    case "rejected":
      return "Submission rejected";
    case "approved":
      return "Submission approved";
    case "picked_up":
      return "Being fabricated";
    case "completed":
      // Phase 7-5: split by completion_status — "ready to collect"
      // for printed/cut vs "couldn't run this" for failed. Null
      // fallback keeps the pre-Phase-7 framing for any edge row
      // that reaches `completed` without a populated
      // completion_status column.
      if (completionStatus === "failed") return "Your run didn't complete";
      if (completionStatus === "printed" || completionStatus === "cut") {
        return "Your file is ready to collect";
      }
      return "Submission complete";
    case "pending_approval":
      return "Waiting for teacher approval";
    default:
      return "Your scan is ready";
  }
}

/**
 * Extracted so the main component stays readable. Computes canSubmit
 * from the live ack state + renders the soft-gate UI + any action error.
 */
function DoneStateView(props: {
  pollState: Extract<ReturnType<typeof useFabricationStatus>["state"], { kind: "done" }>;
  localAcks: AcknowledgedWarnings;
  revisions: RevisionSummary[];
  revisionsError: string | null;
  onAcknowledge: (ruleId: string, choice: AckChoice) => void;
  onSubmit: () => void;
  onReupload: () => void;
  onWithdraw: () => void;
  onDelete: () => void;
  isAckInFlight: boolean;
  isSubmitting: boolean;
  isWithdrawing: boolean;
  isDeleting: boolean;
  actionError: string | null;
}) {
  const {
    pollState,
    localAcks,
    revisions,
    revisionsError,
    onAcknowledge,
    onSubmit,
    onReupload,
    onWithdraw,
    onDelete,
    isAckInFlight,
    isSubmitting,
    isWithdrawing,
    isDeleting,
    actionError,
  } = props;

  const status = pollState.status as JobStatusSuccess;
  const revisionNumber = status.currentRevision;
  const scanResults = (status.scanResults ?? { rules: [] }) as { rules?: Rule[] | null };
  const gate = canSubmit({
    results: scanResults,
    acknowledgedWarnings: localAcks,
    revisionNumber,
  });
  const jobStatus = status.jobStatus;
  const teacherNote = status.teacherReviewNote ?? null;
  const teacherReviewedAt = status.teacherReviewedAt ?? null;
  const showReviewCard = shouldShowReviewCard(jobStatus, teacherNote);
  const actionsLocked = studentActionsLocked(jobStatus);
  const hideSubmit = shouldHideSubmitButton(jobStatus);
  const showWithdraw = canWithdrawJob(jobStatus);
  // Phase 8.1d-32: delete button. Stricter status gate than
  // withdraw — only excludes the two states where the fab/teacher
  // is actively holding the file. So both buttons appear together
  // when the student can EITHER soft-cancel (audit kept) OR
  // hard-delete (no audit, files purged). Cancelled / rejected /
  // completed jobs only show Delete because withdraw makes no
  // sense for terminal-from-student states.
  const showDelete = canDeleteJob(jobStatus);

  // Phase 7-5: lab-tech completion state. When status=completed, the
  // LabTechCompletionCard replaces the ScanResultsViewer — the run is
  // done, the scan rules aren't actionable anymore. Same pattern as
  // rejected (Phase 6-5).
  const completionStatus = status.completionStatus ?? null;
  const completionNote = status.completionNote ?? null;
  const completedAt = status.completedAt ?? null;
  const showCompletionCard = shouldShowCompletionCard(jobStatus);
  const hideScanViewer =
    jobStatus === "rejected" ||
    shouldHideScanViewerForCompletion(jobStatus);

  return (
    <div className="space-y-6">
      {/* Two-column layout (desktop): rule buckets + actions on the
          left, file preview + revision history on the right. Stacks
          to single column on mobile. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN — review card + rule buckets + actions ── */}
        <div className="lg:col-span-2 space-y-4">
          {actionError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-900">{actionError}</p>
            </div>
          )}

          {showReviewCard && (
            <TeacherReviewNoteCard
              jobStatus={jobStatus}
              teacherNote={teacherNote}
              teacherReviewedAt={teacherReviewedAt}
            />
          )}

          {/* Phase 7-5: completed jobs render the lab-tech result
              card (green for printed/cut, red for failed). Replaces
              the scan viewer entirely — run is done, rules aren't
              actionable anymore. Same terminal treatment as
              rejected. */}
          {showCompletionCard && (
            <LabTechCompletionCard
              completionStatus={completionStatus}
              completionNote={completionNote}
              completedAt={completedAt}
            />
          )}

          {/* Scan viewer hidden on rejected + completed (both
              terminal). Otherwise render interactive / read-only
              based on actionsLocked. */}
          {hideScanViewer ? null : (
            <ScanResultsViewer
              scanResults={scanResults}
              acknowledgedWarnings={localAcks}
              revisionNumber={revisionNumber}
              canSubmitState={gate}
              onAcknowledge={onAcknowledge}
              onSubmit={onSubmit}
              onReupload={onReupload}
              isAckInFlight={isAckInFlight}
              isSubmitting={isSubmitting}
              thumbnailUrl={status.revision?.thumbnailUrl ?? null}
              fileType={status.fileType}
              // Approved/completed/picked_up jobs are still visible to
              // the student via direct URL, but actions are locked —
              // same readOnly treatment the teacher detail page uses.
              readOnly={actionsLocked}
              // Hide Submit button on needs_revision (teacher
              // explicitly asked for a fix) and pending_approval
              // (already submitted). Re-upload remains available +
              // becomes the primary purple action.
              // shouldHideSubmitButton is the single source of truth
              // for that decision.
              hideSubmit={hideSubmit}
              // The right-column preview card renders the thumbnail
              // bigger than the inline strip — suppress the viewer's
              // built-in strip to avoid duplication.
              hideHeaderStrip
            />
          )}

          {/* Phase 6-6k + 8.1d-32 — student-reversible actions.
              Rendered under the viewer (not inside it) so the
              teacher detail page's read-only render doesn't show
              these buttons.

              Withdraw — soft cancel, status='cancelled', audit
                         trail kept. Only valid pre-teacher-action.
              Delete   — permanent, no undo, files + revisions +
                         scan results all purged. Valid for any
                         non-active-fabrication state. Different
                         intent so we show both when both apply
                         (the typical mid-flight case where
                         student wants to clean up cleanly).
              */}
          {(showWithdraw || showDelete) && (
            <div className="flex justify-end items-center gap-4">
              {showWithdraw && (
                <button
                  type="button"
                  onClick={onWithdraw}
                  disabled={
                    isWithdrawing ||
                    isDeleting ||
                    isSubmitting ||
                    isAckInFlight
                  }
                  className="text-sm font-medium text-gray-600 hover:text-red-700 underline underline-offset-2 decoration-gray-400 hover:decoration-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
                >
                  {isWithdrawing ? "Withdrawing…" : "Withdraw submission"}
                </button>
              )}
              {showDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={
                    isDeleting ||
                    isWithdrawing ||
                    isSubmitting ||
                    isAckInFlight
                  }
                  className="text-sm font-medium text-red-700 hover:text-red-900 underline underline-offset-2 decoration-red-400 hover:decoration-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
                  title="Permanently delete this submission and all its files"
                >
                  {isDeleting ? "Deleting…" : "Delete permanently"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN — preview + revision history ── */}
        <aside className="lg:col-span-1 space-y-4">
          <PreviewCard
            thumbnailUrl={status.revision?.thumbnailUrl ?? null}
            revisionNumber={revisionNumber}
            fileType={status.fileType}
          />

          {/* Revision history — hidden when only 1 revision exists */}
          <RevisionHistoryPanel
            revisions={revisions}
            currentRevision={revisionNumber}
          />
          {revisionsError && (
            <p className="text-xs text-gray-500 italic">{revisionsError}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

// PreviewCard + PreviewModal extracted to
// components/fabrication/PreviewCard.tsx in Phase 6-6j so the
// teacher detail page can reuse them alongside its own 2-column
// layout. Imported at the top of this file.
