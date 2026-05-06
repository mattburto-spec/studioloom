"use client";

/**
 * TimelineAddMilestoneModal — modal composer for "+ Add milestone".
 *
 * Round 21 (6 May 2026 PM) — replaces the two stacked window.prompt()
 * calls (label, then date as text "YYYY-MM-DD") with a proper modal:
 *   - Label input (required, autofocused)
 *   - Native date picker (<input type="date">) — can be left empty
 *   - Save / Cancel
 *   - Enter submits, Escape cancels
 *
 * `<input type="date">` already produces "YYYY-MM-DD" strings on submit,
 * which is exactly what the reducer's addMilestone action expects. No
 * format coercion needed.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  onSubmit: (label: string, targetDate: string | null) => void;
  onClose: () => void;
}

export default function TimelineAddMilestoneModal({
  onSubmit,
  onClose,
}: Props) {
  const [label, setLabel] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    const trimmed = label.trim();
    if (!trimmed) return;
    onSubmit(
      trimmed,
      targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
        ? targetDate
        : null
    );
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        data-testid="timeline-add-milestone-scrim"
        aria-hidden="true"
      />

      {/* Centered card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add milestone"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(100%-2rem,28rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        data-testid="timeline-add-milestone-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-[10.5px] uppercase tracking-wide text-gray-500">
            Add milestone
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-3 -mr-1 -mt-1 p-1 rounded hover:bg-gray-100"
            aria-label="Close"
            data-testid="timeline-add-milestone-close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          <label className="block">
            <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
              Label
            </span>
            <input
              ref={inputRef}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }}
              maxLength={120}
              placeholder="e.g. Chassis cut"
              className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
              data-testid="timeline-add-milestone-label-input"
            />
          </label>

          <label className="block">
            <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
              Target date <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }}
              className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
              data-testid="timeline-add-milestone-date-input"
            />
            <p className="text-[10.5px] text-gray-500 mt-1 leading-snug">
              Leave blank if you&apos;re not committing to a date yet — you can
              add one later from the row.
            </p>
          </label>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[11.5px] px-3 py-1.5 rounded text-gray-600 hover:text-gray-900"
            data-testid="timeline-add-milestone-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!label.trim()}
            className={[
              "text-[11.5px] px-3 py-1.5 rounded font-semibold",
              label.trim()
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-violet-300 text-white cursor-not-allowed",
            ].join(" ")}
            data-testid="timeline-add-milestone-submit"
          >
            Add milestone
          </button>
        </div>
      </div>
    </>
  );
}
