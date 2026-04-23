"use client";

/**
 * LabTechActionBar — Phase 7-4 completion actions for
 * /fab/jobs/[jobId]. Parallel to TeacherActionBar but
 * fabricator-shaped:
 *
 *   status=approved      → Download + Pick Up (primary)
 *   status=picked_up     → Re-download (secondary)
 *                          Mark Complete (green)
 *                          Mark Failed (red outline, note required)
 *   status=completed     → read-only completion summary (rendered
 *                          by the detail page, not here)
 *   anything else        → nothing (terminal from lab-tech POV)
 *
 * Dark slate theme — matches /fab/queue.
 *
 * The Download button is an anchor tag pointing at the download
 * route handler (7-2) so the browser's native download flow
 * handles the bytes + Content-Disposition rename. After click we
 * tell the parent so it can re-fetch detail to reflect the status
 * change (approved → picked_up).
 */

import * as React from "react";
import {
  fabCannedNotesForAction,
  insertFabCannedNote,
} from "@/lib/fabrication/lab-tech-canned-notes";

const PRESS = "transition-all active:scale-[0.97] disabled:active:scale-100";

export interface LabTechActionBarProps {
  jobId: string;
  jobStatus: string;
  isBusy: boolean;
  /** Called when the download was triggered (anchor click fires; we
   *  can't strictly know the bytes downloaded but we know the user
   *  clicked + the status will have transitioned). Parent usually
   *  refetches detail. */
  onDownloadTriggered: () => void;
  onComplete: (note: string | undefined) => void;
  onFail: (note: string) => void;
}

type ActiveModal = null | "complete" | "fail";

export function LabTechActionBar({
  jobId,
  jobStatus,
  isBusy,
  onDownloadTriggered,
  onComplete,
  onFail,
}: LabTechActionBarProps) {
  const [activeModal, setActiveModal] = React.useState<ActiveModal>(null);
  const [noteDraft, setNoteDraft] = React.useState("");

  function openModal(kind: Exclude<ActiveModal, null>) {
    setNoteDraft("");
    setActiveModal(kind);
  }
  function closeModal() {
    setActiveModal(null);
    setNoteDraft("");
  }
  function submitModal() {
    if (activeModal === "complete") {
      onComplete(noteDraft.trim() || undefined);
    } else if (activeModal === "fail") {
      if (!noteDraft.trim()) return; // required
      onFail(noteDraft.trim());
    }
    closeModal();
  }

  // Nothing to render on terminal statuses — the parent shows a
  // completion summary instead.
  if (
    jobStatus === "completed" ||
    jobStatus === "rejected" ||
    jobStatus === "cancelled"
  ) {
    return null;
  }

  const downloadHref = `/api/fab/jobs/${jobId}/download`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      {jobStatus === "approved" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Click download to pick up this job. The file saves with an
            auto-named filename
            <span className="text-slate-500">
              {" "}
              (student · class · unit)
            </span>{" "}
            so it&apos;s clear which student&apos;s run it is.
          </p>
          {/* Anchor-tag download — browser handles bytes + filename.
              After click, we tell the parent to refetch so the UI
              reflects status=picked_up. */}
          <a
            href={downloadHref}
            onClick={() => onDownloadTriggered()}
            className={`block w-full text-center py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-bold ${PRESS}`}
          >
            Download &amp; pick up
          </a>
        </div>
      )}

      {jobStatus === "picked_up" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {/* Re-download for lab techs who closed the tab mid-print */}
            <a
              href={downloadHref}
              onClick={() => onDownloadTriggered()}
              className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-700 ${PRESS}`}
            >
              Re-download
            </a>
            <button
              type="button"
              onClick={() => openModal("complete")}
              disabled={isBusy}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${PRESS}`}
            >
              Mark complete
            </button>
            <button
              type="button"
              onClick={() => openModal("fail")}
              disabled={isBusy}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg border border-red-600/70 text-red-300 hover:bg-red-950/40 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${PRESS}`}
            >
              Mark failed
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Once the run is done, mark it complete so the student sees
            their file is ready to collect. Mark failed if it didn&apos;t
            run — a note is required so the student + teacher know
            what happened.
          </p>
        </div>
      )}

      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-100 mb-2">
              {activeModal === "complete" ? "Mark complete" : "Mark failed"}
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              {activeModal === "complete"
                ? "Optional note — anything notable for the student? ('stringing on overhangs', 'nice clean cut', etc.)"
                : "A note is required so the student + teacher know what went wrong."}
            </p>

            {/* Quick inserts — parallel to TeacherActionBar's 6-6l strip. */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Quick inserts
              </p>
              <div className="flex flex-wrap gap-1.5">
                {fabCannedNotesForAction(activeModal).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setNoteDraft((current) =>
                        insertFabCannedNote(current, preset)
                      )
                    }
                    title={preset}
                    className={`text-left text-xs px-2.5 py-1 rounded-full border border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800 hover:border-sky-500/40 max-w-full ${PRESS}`}
                  >
                    <span className="line-clamp-1 block">{preset}</span>
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={5}
              placeholder={
                activeModal === "fail"
                  ? "e.g. Warped off the bed around layer 12"
                  : "Optional message to the student…"
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeModal}
                className={`px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 ${PRESS}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitModal}
                disabled={activeModal === "fail" && !noteDraft.trim()}
                className={
                  activeModal === "complete"
                    ? `px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${PRESS}`
                    : `px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-slate-950 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${PRESS}`
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LabTechActionBar;
