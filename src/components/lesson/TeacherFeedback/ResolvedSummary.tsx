/**
 * ResolvedSummary — collapsed thread row.
 *
 * Designer spec (TFL.2 Pass A): when the thread reaches `resolved`
 * (latest turn is `student.sentiment === "got_it"`), the bubble
 * collapses to a single 56px row: emerald border, mint bg, white-on-
 * emerald check disc, "Resolved · {teacher}'s feedback" + truncated
 * body preview, "Re-open ↑" affordance on the right.
 *
 * Click anywhere on the row re-expands to the full thread (the parent
 * tracks the expanded state and re-renders <Thread />).
 */

"use client";

import * as React from "react";
import type { TeacherTurn } from "./types";
import { BubbleFrame } from "./BubbleFrame";

interface ResolvedSummaryProps {
  /** Show the latest teacher turn's body as the preview text. */
  latestTeacherTurn: TeacherTurn;
  /** Total turn count to surface in the aria label. */
  turnCount: number;
  onReopen: () => void;
}

function stripHtml(html: string): string {
  // Coarse strip — fine for a preview snippet. The full HTML lives
  // intact in the expanded Thread view.
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function previewText(html: string, maxChars = 80): string {
  const text = stripHtml(html);
  return text.length > maxChars ? text.slice(0, maxChars).trimEnd() + "…" : text;
}

export function ResolvedSummary({
  latestTeacherTurn,
  turnCount,
  onReopen,
}: ResolvedSummaryProps) {
  const preview = previewText(latestTeacherTurn.bodyHTML);
  return (
    // BubbleFrame supplies the outline + tail. The button inside is
    // border/bg-transparent so the SVG outline reads cleanly.
    <BubbleFrame variant="teacher" dataState="resolved-summary">
      <button
        type="button"
        onClick={onReopen}
        data-testid="teacher-feedback-resolved-summary"
        aria-expanded={false}
        aria-label={`Resolved feedback thread from ${latestTeacherTurn.authorName}, ${turnCount} turns. Click to re-open.`}
        className="w-full flex items-center gap-3 px-3 py-3 group text-left bg-transparent border-0 cursor-pointer hover:bg-emerald-100/40 transition-colors rounded-3xl"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="4 12 9 17 20 6" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Resolved · {latestTeacherTurn.authorName}'s feedback
          </div>
          <div className="text-sm text-emerald-950 truncate">{preview}</div>
        </div>
        <div className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 opacity-70 group-hover:opacity-100 transition-opacity">
          Re-open
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      </button>
    </BubbleFrame>
  );
}
