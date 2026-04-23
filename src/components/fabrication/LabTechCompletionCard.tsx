"use client";

/**
 * LabTechCompletionCard — Phase 7-4 student-side result card.
 *
 * Shown on `/fabrication/jobs/[jobId]` when the job reaches
 * status=completed. Threaded in by Phase 7-5 (the last step of
 * Phase 7 that closes the full loop).
 *
 * Three variants keyed on `completion_status`:
 *
 *   printed / cut  → green card: "Your file is ready to collect"
 *                    with optional lab-tech note + timestamp.
 *                    NO scan-results viewer (terminal from student
 *                    POV — same pattern as approved/rejected).
 *
 *   failed         → red card: "The lab tech couldn't run this"
 *                    with the required note + "Start a fresh
 *                    submission →" CTA.
 *
 *   null / unknown → defensive fallback (shouldn't happen — DB
 *                    CHECK constraint enforces the enum) — we
 *                    render a neutral "completed" card so the UI
 *                    doesn't blow up.
 *
 * Parallel to TeacherReviewNoteCard (Phase 6-5) in shape + tone.
 */

import * as React from "react";
import Link from "next/link";
import { formatRelativeTime } from "./revision-history-helpers";

export interface LabTechCompletionCardProps {
  completionStatus: string | null;
  completionNote: string | null;
  completedAt: string | null;
}

interface Variant {
  heading: string;
  hint: string;
  rootClass: string;
  headingClass: string;
  noteBlockClass: string;
  footerClass: string;
  showStartFresh: boolean;
}

function variantFor(completionStatus: string | null): Variant {
  if (completionStatus === "failed") {
    return {
      heading: "The lab tech couldn't run this",
      hint: "Read the note below, then start a fresh submission when you're ready.",
      rootClass: "rounded-2xl border border-red-200 bg-red-50 p-5",
      headingClass: "text-red-900 font-bold text-base",
      noteBlockClass: "rounded-lg border border-red-200 bg-white p-3 mt-3",
      footerClass: "text-xs text-red-700 mt-2",
      showStartFresh: true,
    };
  }
  // printed / cut (successful) OR defensive fallback
  return {
    heading:
      completionStatus === "cut"
        ? "Your file has been cut and is ready to collect"
        : completionStatus === "printed"
          ? "Your file has been printed and is ready to collect"
          : "Your submission is complete",
    hint: "Head to the fabrication area to pick it up.",
    rootClass: "rounded-2xl border border-green-200 bg-green-50 p-5",
    headingClass: "text-green-900 font-bold text-base",
    noteBlockClass:
      "rounded-lg border border-green-200 bg-white p-3 mt-3",
    footerClass: "text-xs text-green-700 mt-2",
    showStartFresh: false,
  };
}

export function LabTechCompletionCard({
  completionStatus,
  completionNote,
  completedAt,
}: LabTechCompletionCardProps) {
  const v = variantFor(completionStatus);
  const when = completedAt ? formatRelativeTime(completedAt) : null;

  return (
    <div className={v.rootClass}>
      <h2 className={v.headingClass}>{v.heading}</h2>
      <p className="text-sm text-gray-700 mt-1">{v.hint}</p>

      {completionNote && completionNote.trim() && (
        <div className={v.noteBlockClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Lab tech note
          </p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {completionNote}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {when && <p className={v.footerClass}>completed {when}</p>}
        {v.showStartFresh && (
          <Link
            href="/fabrication/new"
            className="text-sm font-semibold text-red-900 underline hover:no-underline transition-all active:scale-[0.97]"
          >
            Start a fresh submission →
          </Link>
        )}
      </div>
    </div>
  );
}

export default LabTechCompletionCard;
