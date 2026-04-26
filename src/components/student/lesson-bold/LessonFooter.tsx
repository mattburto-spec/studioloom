"use client";

import React from "react";

type NextPreview = {
  /** Lesson counter — e.g. "Next · Lesson 2". Caller builds the copy. */
  eyebrow: string;
  /** Short lesson title (truncates on narrow screens). */
  title: string;
  /** Optional duration label, e.g. "25 min". */
  durationLabel?: string;
};

type Props = {
  /** When absent, Previous button is disabled. */
  onPrev?: () => void;
  /** Shown as the right-side primary button. */
  onComplete: () => void | Promise<void>;
  /** Disables interactive controls while a save is in flight. */
  saving?: boolean;
  /** Label on the primary button. Defaults based on whether nextPreview exists. */
  completeLabel?: string;
  /** Middle preview chip. Omit on final lesson — the button just says "Mark as Complete". */
  nextPreview?: NextPreview;
};

function ArrowRightIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ArrowLeftIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

function ClockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function LessonFooter({
  onPrev,
  onComplete,
  saving,
  completeLabel,
  nextPreview,
}: Props) {
  const primaryLabel =
    completeLabel ??
    (saving ? "Saving…" : nextPreview ? "Complete & continue" : "Mark as complete");

  return (
    <div
      className="mt-8"
      style={{
        background: "var(--sl-paper)",
        borderTop: "1px solid var(--sl-hair)",
      }}
    >
      <div
        className="max-w-5xl mx-auto flex items-center gap-3 md:gap-4 flex-wrap"
        style={{ padding: "16px 24px" }}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={!onPrev || saving}
          className="inline-flex items-center gap-1.5 rounded-full font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            fontSize: "12px",
            padding: "10px 16px",
            background: "var(--sl-paper)",
            color: "var(--sl-ink)",
            border: "1px solid var(--sl-hair)",
          }}
        >
          <ArrowLeftIcon />
          Previous
        </button>

        {nextPreview && (
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "var(--sl-bg)",
                border: "1px solid var(--sl-hair)",
                color: "var(--sl-ink)",
              }}
              aria-hidden="true"
            >
              <ArrowRightIcon size={15} />
            </div>
            <div className="min-w-0">
              <div className="cap" style={{ color: "var(--sl-ink-3)" }}>
                {nextPreview.eyebrow}
              </div>
              <div
                className="font-extrabold leading-tight truncate"
                style={{ fontSize: "13px", color: "var(--sl-ink)" }}
              >
                {nextPreview.title}
              </div>
            </div>
          </div>
        )}

        {!nextPreview && <div className="flex-1" />}

        {nextPreview?.durationLabel && (
          <div
            className="hidden md:inline-flex items-center gap-1.5 font-extrabold"
            style={{ fontSize: "11px", color: "var(--sl-ink-3)" }}
          >
            <ClockIcon />
            {nextPreview.durationLabel}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            void onComplete();
          }}
          disabled={saving}
          className="btn-primary inline-flex items-center gap-1.5 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontSize: "12.5px",
            padding: "10px 24px",
          }}
        >
          {primaryLabel}
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}
