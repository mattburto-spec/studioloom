"use client";

/**
 * TeacherActionBar — Phase 6-2. Approve / Return-for-revision / Reject
 * / Note buttons for the teacher detail page.
 *
 * Stateless controlled component. Parent owns:
 *   - jobStatus (to enable/disable the transition buttons — only
 *     pending_approval is actionable)
 *   - current teacher_review_note (renders above the buttons)
 *   - isBusy flag (all buttons disable while an action is in-flight)
 *   - onApprove / onReturn / onReject / onNote handlers
 *
 * Return-for-revision opens a local modal that captures the required
 * note. Reject + Note + Approve use simpler inline prompt boxes
 * (approve and reject's note are optional; note endpoint requires non-
 * empty). Intentionally lightweight — teachers are on laptops, this
 * isn't the place for heavyweight modals.
 */

import * as React from "react";

/**
 * Shared press-animation suffix for preflight action buttons (Phase
 * 6-6k). Applied to every primary-action button in the surface so
 * there's consistent tactile feedback on click. Disabled state
 * cancels the scale animation so it's obvious nothing's happening.
 */
const PRESS = "transition-all active:scale-[0.97] disabled:active:scale-100";

export interface TeacherActionBarProps {
  jobStatus: string;
  currentNote: string | null;
  isBusy: boolean;
  /** Optional note string on the approve/reject actions. Return
   *  requires non-empty; Note endpoint requires non-empty. */
  onApprove: (note: string | undefined) => void;
  onReturn: (note: string) => void;
  onReject: (note: string | undefined) => void;
  onSaveNote: (note: string) => void;
}

type ActiveModal = null | "return" | "reject" | "note" | "approve-note";

export function TeacherActionBar(props: TeacherActionBarProps) {
  const { jobStatus, currentNote, isBusy } = props;
  const [activeModal, setActiveModal] = React.useState<ActiveModal>(null);
  const [noteDraft, setNoteDraft] = React.useState("");

  const canTakeAction = jobStatus === "pending_approval" && !isBusy;

  function openModal(kind: Exclude<ActiveModal, null>) {
    setNoteDraft("");
    setActiveModal(kind);
  }
  function closeModal() {
    setActiveModal(null);
    setNoteDraft("");
  }

  function submitModal() {
    if (activeModal === "return") {
      if (!noteDraft.trim()) return; // required
      props.onReturn(noteDraft.trim());
    } else if (activeModal === "reject") {
      props.onReject(noteDraft.trim() || undefined);
    } else if (activeModal === "note") {
      if (!noteDraft.trim()) return;
      props.onSaveNote(noteDraft.trim());
    } else if (activeModal === "approve-note") {
      props.onApprove(noteDraft.trim() || undefined);
    }
    closeModal();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      {currentNote && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-1">
            Your current note
          </p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{currentNote}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => props.onApprove(undefined)}
          disabled={!canTakeAction}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 ${PRESS}`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => openModal("approve-note")}
          disabled={!canTakeAction}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg border border-green-600 text-green-700 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-50 ${PRESS}`}
        >
          Approve with note
        </button>
        <button
          type="button"
          onClick={() => openModal("return")}
          disabled={!canTakeAction}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-600 ${PRESS}`}
        >
          Return for revision
        </button>
        <button
          type="button"
          onClick={() => openModal("reject")}
          disabled={!canTakeAction}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg border border-red-600 text-red-700 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-50 ${PRESS}`}
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => openModal("note")}
          disabled={isBusy}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 ${PRESS}`}
        >
          Add/update note
        </button>
      </div>

      {!canTakeAction && jobStatus !== "pending_approval" && !isBusy && (
        <p className="text-xs text-gray-500 italic">
          This job is in status <code>{jobStatus}</code> — Approve / Return /
          Reject only apply while the student is waiting for approval. You can
          still add a note.
        </p>
      )}

      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {activeModal === "return" && "Return for revision"}
              {activeModal === "reject" && "Reject submission"}
              {activeModal === "note" && "Add/update note"}
              {activeModal === "approve-note" && "Approve with note"}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {activeModal === "return" &&
                "The student will see this message on their status page and re-upload a fixed version. A note is required."}
              {activeModal === "reject" &&
                "Student cannot re-upload this submission. A note helps explain why (optional but encouraged, especially for safety-flagged content)."}
              {activeModal === "note" &&
                "Leave a note without changing the submission's state. Overwrites any existing note."}
              {activeModal === "approve-note" &&
                "Approve the submission and leave an optional message for the student."}
            </p>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              placeholder={
                activeModal === "return"
                  ? "e.g. Wall at the back is too thin — bump to 1 mm"
                  : "Your message…"
              }
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeModal}
                className={`px-4 py-2 rounded-lg border border-gray-300 text-gray-800 text-sm font-semibold hover:bg-gray-50 ${PRESS}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitModal}
                disabled={
                  // Return + note require non-empty; approve-note + reject allow empty.
                  (activeModal === "return" || activeModal === "note") &&
                  !noteDraft.trim()
                }
                className={`px-4 py-2 rounded-lg bg-brand-purple text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${PRESS}`}
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

export default TeacherActionBar;
