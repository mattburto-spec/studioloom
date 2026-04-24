"use client";

/**
 * TeacherReviewNoteCard — Phase 6-5 student-side review card.
 *
 * Renders the amber/red/green notice + optional teacher's note on
 * the student's `/fabrication/jobs/[jobId]` page after a teacher
 * actions the job.
 *
 * The component is a pure presentation layer — style selection lives
 * in `teacher-review-note-helpers.ts` so tests don't need a DOM
 * render harness. Callers pass through:
 *   - jobStatus       — drives the variant (amber / red / green)
 *   - teacherNote     — rendered verbatim in a preserve-whitespace
 *                       block (plain text v1; markdown can come
 *                       later via PH5-FU-NOTE-HISTORY / Phase 9)
 *   - teacherReviewedAt — ISO string for the "reviewed 3h ago" footer
 *
 * When jobStatus doesn't trigger a review card (uploaded / scanning /
 * pending_approval / etc.), returns null so the caller can compose
 * unconditionally.
 */

import * as React from "react";
import Link from "next/link";
import {
  teacherReviewStyleFor,
  formatReviewedAt,
  shouldShowReviewCard,
} from "./teacher-review-note-helpers";

export interface TeacherReviewNoteCardProps {
  jobStatus: string;
  teacherNote: string | null;
  teacherReviewedAt: string | null;
}

export function TeacherReviewNoteCard({
  jobStatus,
  teacherNote,
  teacherReviewedAt,
}: TeacherReviewNoteCardProps) {
  if (!shouldShowReviewCard(jobStatus, teacherNote)) return null;

  const style = teacherReviewStyleFor(jobStatus);
  const when = formatReviewedAt(teacherReviewedAt);

  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 ${style.cardClass}`}
    >
      <h2 className={`text-base font-bold ${style.headingClass}`}>
        {style.heading}
      </h2>
      <p className="text-sm text-gray-800 mt-1">{style.hint}</p>

      {teacherNote && teacherNote.trim().length > 0 ? (
        <div className="mt-3 rounded-lg bg-white/70 border border-white/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
            Teacher&apos;s note
          </p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">
            {teacherNote}
          </p>
        </div>
      ) : (
        style.variant !== "approved" && (
          <p className="text-xs text-gray-600 italic mt-3">
            {style.variant === "rejected"
              ? "Your teacher did not leave a note with this rejection."
              : "Your teacher did not leave a note — check with them directly if you need guidance."}
          </p>
        )
      )}

      {(when || style.showStartFreshCta) && (
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          {when ? (
            <p className="text-xs text-gray-500">{when}</p>
          ) : (
            <span />
          )}
          {style.showStartFreshCta && (
            <Link
              href="/fabrication/new"
              className="text-sm font-semibold underline text-red-900 hover:no-underline"
            >
              Start a fresh submission →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export default TeacherReviewNoteCard;
