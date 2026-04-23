"use client";

/**
 * FabJobDetailClient — Phase 7-4 interactive body of
 * /fab/jobs/[jobId].
 *
 * Layout:
 *   ← Back
 *   ┌───────────────────────────────────────────────────┐
 *   │ Header card: student · class · unit · machine     │
 *   │              filename · Rev N · size · submitted  │
 *   │              status pill                          │
 *   └───────────────────────────────────────────────────┘
 *   ┌───────────────────────────────────────────────────┐
 *   │ Teacher's review note (if any)                    │
 *   └───────────────────────────────────────────────────┘
 *   ┌───────────────────────────────────────────────────┐
 *   │ Scan summary: "2B · 1W · 3I" rule counts +        │
 *   │ thumbnail preview                                  │
 *   └───────────────────────────────────────────────────┘
 *   ┌───────────────────────────────────────────────────┐
 *   │ LabTechActionBar (download / mark complete / fail)│
 *   │ OR completion summary if job is already completed │
 *   └───────────────────────────────────────────────────┘
 *
 * Single column (lab tech flow is top-to-bottom: read context →
 * download → run → mark done). Dark slate matches /fab/queue.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { FabJobDetail } from "@/lib/fabrication/fab-orchestration";
import { formatRelativeTime } from "@/components/fabrication/revision-history-helpers";
import {
  formatFileSize,
  machineCategoryLabel,
} from "@/components/fabrication/fab-queue-helpers";
import { LabTechActionBar } from "@/components/fabrication/LabTechActionBar";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; detail: FabJobDetail };

export default function FabJobDetailClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const fetchDetail = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setState({
          kind: "error",
          message:
            body.error || `Couldn't load the job (HTTP ${res.status})`,
        });
        return;
      }
      const data = (await res.json()) as FabJobDetail;
      setState({ kind: "ready", detail: data });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, [jobId]);

  React.useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/fab/queue");
    }
  }

  function handleDownloadTriggered() {
    // Anchor-tag download fires before the server has fully
    // transitioned. Small delay then refetch — the download handler
    // updates status=approved → picked_up as part of the same
    // request, so by the time we fetch again the status pill will
    // reflect the new state.
    setTimeout(() => void fetchDetail(), 600);
  }

  async function runAction(
    endpoint: "complete" | "fail",
    body: Record<string, unknown>,
    successMessage: string
  ) {
    setActionError(null);
    setActionSuccess(null);
    setIsBusy(true);
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}/${endpoint}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "" }));
        setActionError(
          errBody.error || `Action failed (HTTP ${res.status})`
        );
        return;
      }
      setActionSuccess(successMessage);
      await fetchDetail();
      // Same scroll-to-top affordance as teacher detail page so the
      // lab tech sees the confirmation banner + updated status pill.
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error");
    } finally {
      setIsBusy(false);
    }
  }

  function handleComplete(note: string | undefined) {
    void runAction(
      "complete",
      note ? { completion_note: note } : {},
      "Marked complete — student will be notified."
    );
  }
  function handleFail(note: string) {
    void runAction(
      "fail",
      { completion_note: note },
      "Marked failed — student will be notified."
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-sm">
        <button
          type="button"
          onClick={handleBack}
          className="text-sky-300 hover:underline transition-all active:scale-[0.97]"
        >
          ← Back
        </button>
      </div>

      {state.kind === "loading" && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading job…</span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-red-900 bg-red-950/50 p-4">
          <p className="text-sm text-red-200">{state.message}</p>
          <button
            type="button"
            onClick={() => void fetchDetail()}
            className="mt-3 text-xs font-semibold text-red-200 underline hover:no-underline transition-all active:scale-[0.97]"
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === "ready" && (
        <ReadyView
          detail={state.detail}
          actionError={actionError}
          actionSuccess={actionSuccess}
          isBusy={isBusy}
          onDownloadTriggered={handleDownloadTriggered}
          onComplete={handleComplete}
          onFail={handleFail}
        />
      )}
    </div>
  );
}

function ReadyView({
  detail,
  actionError,
  actionSuccess,
  isBusy,
  onDownloadTriggered,
  onComplete,
  onFail,
}: {
  detail: FabJobDetail;
  actionError: string | null;
  actionSuccess: string | null;
  isBusy: boolean;
  onDownloadTriggered: () => void;
  onComplete: (note: string | undefined) => void;
  onFail: (note: string) => void;
}) {
  const { job, student, classInfo, unit, machine, currentRevisionData } =
    detail;
  const pill = statusPillClass(job.status);
  const submittedWhen = job.approvedAt
    ? `Approved ${formatRelativeTime(job.approvedAt)}`
    : null;
  const pickedUpWhen = job.pickedUpAt
    ? `Picked up ${formatRelativeTime(job.pickedUpAt)}`
    : null;
  const completedWhen = job.completedAt
    ? `Completed ${formatRelativeTime(job.completedAt)}`
    : null;

  const counts = currentRevisionData?.ruleCounts;
  const countsDisplay = counts
    ? [
        counts.block > 0 ? `${counts.block}B` : null,
        counts.warn > 0 ? `${counts.warn}W` : null,
        counts.fyi > 0 ? `${counts.fyi}I` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "clean"
    : null;

  return (
    <>
      {/* Context header card */}
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-slate-100">{student.name}</h1>
          {classInfo && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-semibold mt-1">
              {classInfo.name}
            </span>
          )}
          {unit && (
            <span className="text-sm text-slate-400 mt-1">· {unit.title}</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
          <span>
            <span className="text-slate-200 font-semibold">
              {machine.name}
            </span>{" "}
            <span className="text-slate-500">
              ({machineCategoryLabel(machine.category)})
            </span>
          </span>
          <span aria-hidden="true" className="text-slate-700">
            ·
          </span>
          <span>
            <code className="text-xs text-slate-300">{job.originalFilename}</code>
          </span>
          <span aria-hidden="true" className="text-slate-700">
            ·
          </span>
          <span>Rev {job.currentRevision}</span>
          {currentRevisionData?.fileSizeBytes != null && (
            <>
              <span aria-hidden="true" className="text-slate-700">
                ·
              </span>
              <span>{formatFileSize(currentRevisionData.fileSizeBytes)}</span>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${pill}`}
          >
            {job.status.replace(/_/g, " ")}
          </span>
          {submittedWhen && (
            <span className="text-xs text-slate-500">{submittedWhen}</span>
          )}
          {pickedUpWhen && (
            <span className="text-xs text-slate-500">· {pickedUpWhen}</span>
          )}
          {completedWhen && (
            <span className="text-xs text-slate-500">· {completedWhen}</span>
          )}
        </div>
      </header>

      {/* Action feedback */}
      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-900 bg-red-950/50 p-3"
        >
          <p className="text-sm text-red-200">{actionError}</p>
        </div>
      )}
      {actionSuccess && !actionError && (
        <div
          role="status"
          className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3"
        >
          <p className="text-sm text-emerald-200">{actionSuccess}</p>
        </div>
      )}

      {/* Teacher's review note (approve/return/reject notes all land
          in the same teacher_review_note column). Lab tech sees any
          heads-up the teacher left — per brief §11 Q9. */}
      {job.teacherReviewNote && (
        <div className="rounded-xl border border-sky-900 bg-sky-950/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300 mb-1">
            Teacher's note
          </p>
          <p className="text-sm text-slate-200 whitespace-pre-wrap">
            {job.teacherReviewNote}
          </p>
        </div>
      )}

      {/* Scan summary — rule counts + thumbnail. Lab tech doesn't
          need the full 3-bucket viewer; they just need a glance at
          "did this file have major issues?". */}
      {currentRevisionData && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
              {currentRevisionData.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentRevisionData.thumbnailUrl}
                  alt="Scan preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span aria-hidden="true" className="text-slate-700 text-xs">
                  no preview
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Scan summary
              </p>
              <p className="text-base text-slate-200 mt-1">
                {countsDisplay === "clean" ? (
                  <span className="text-emerald-300">
                    No issues flagged during scan
                  </span>
                ) : countsDisplay ? (
                  <>
                    <span className="font-mono text-slate-300">
                      {countsDisplay}
                    </span>
                    <span className="text-slate-500">
                      {" "}
                      (B = blocker, W = warning, I = info)
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">Scan not completed</span>
                )}
              </p>
              {counts && (counts.block > 0 || counts.warn > 0) && (
                <p className="text-xs text-slate-400 mt-2">
                  The student acknowledged these before the teacher approved.
                  Check the file visually before running.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action bar (Download / Complete / Fail) OR completion summary */}
      {job.status === "completed" ? (
        <CompletionSummary
          completionStatus={job.completionStatus}
          completionNote={job.completionNote}
        />
      ) : (
        <LabTechActionBar
          jobId={job.id}
          jobStatus={job.status}
          isBusy={isBusy}
          onDownloadTriggered={onDownloadTriggered}
          onComplete={onComplete}
          onFail={onFail}
        />
      )}
    </>
  );
}

/**
 * Read-only completion summary shown on `/fab/jobs/[jobId]` when the
 * fabricator has already marked this job complete or failed. Mirrors
 * the student-side LabTechCompletionCard visually but in the dark
 * slate theme.
 */
function CompletionSummary({
  completionStatus,
  completionNote,
}: {
  completionStatus: string | null;
  completionNote: string | null;
}) {
  const isFailure = completionStatus === "failed";
  const label = isFailure
    ? "Marked failed"
    : completionStatus === "cut"
      ? "Marked complete (cut)"
      : completionStatus === "printed"
        ? "Marked complete (printed)"
        : "Marked complete";

  return (
    <div
      className={`rounded-xl border p-4 ${
        isFailure
          ? "border-red-900 bg-red-950/30"
          : "border-emerald-900 bg-emerald-950/30"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          isFailure ? "text-red-200" : "text-emerald-200"
        }`}
      >
        {label}
      </p>
      {completionNote && (
        <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">
          {completionNote}
        </p>
      )}
    </div>
  );
}

function statusPillClass(status: string): string {
  switch (status) {
    case "approved":
      return "bg-sky-900 text-sky-200";
    case "picked_up":
      return "bg-amber-900 text-amber-200";
    case "completed":
      return "bg-emerald-900 text-emerald-200";
    case "rejected":
    case "cancelled":
      return "bg-red-900 text-red-200";
    default:
      return "bg-slate-800 text-slate-300";
  }
}
