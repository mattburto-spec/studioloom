"use client";

import React from "react";
import type { CriterionChip } from "@/lib/frameworks/render-helpers";

export type { CriterionChip };

type Props = {
  /** Phase / unit-phase name — rendered as the top-left coloured eyebrow. */
  phaseName?: string;
  /** Hex / CSS color driving the accent tone for this lesson. */
  phaseColor: string;
  /** 1-indexed lesson position within enabled pages. */
  lessonIndex: number;
  lessonTotal: number;
  /** Optional strand / criterion label rendered in the meta row. */
  strandLabel?: string;
  /** Lesson title. Use `titleAccentWord` to italicise one word in serif. */
  title: string;
  /** Word inside `title` to emphasise with Instrument Serif italic. Must appear verbatim in title (case-insensitive). */
  titleAccentWord?: string;
  /** Short editorial prompt under the title. Left out when not provided. */
  whyItMatters?: string;
  /** 1-3 learning objectives → rendered as numbered 3-up strip. */
  learningObjectives?: string[];
  /** Criterion chips from collectCriterionChips(sections, framework). */
  criterionChips?: CriterionChip[];
  /** Summative assessment badge. */
  summative?: boolean;
  /** Top-right action slot — typically ExportPagePdf + Listen button. */
  actions?: React.ReactNode;
};

/**
 * Splits `title` into [before, accent, after] based on the accent word.
 * Returns [title, null, null] if accent word isn't found.
 */
function splitTitle(
  title: string,
  accent?: string
): [string, string | null, string | null] {
  if (!accent) return [title, null, null];
  const idx = title.toLowerCase().indexOf(accent.toLowerCase());
  if (idx === -1) return [title, null, null];
  return [
    title.slice(0, idx),
    title.slice(idx, idx + accent.length),
    title.slice(idx + accent.length),
  ];
}

export function LessonHeader({
  phaseName,
  phaseColor,
  lessonIndex,
  lessonTotal,
  strandLabel,
  title,
  titleAccentWord,
  whyItMatters,
  learningObjectives,
  criterionChips,
  summative,
  actions,
}: Props) {
  const [before, accent, after] = splitTitle(title, titleAccentWord);

  return (
    <div className="card-lb overflow-hidden">
      {/* Top accent stripe uses the phase color */}
      <div style={{ height: "4px", background: phaseColor }} />

      <div className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap">
              {phaseName && (
                <div
                  className="inline-flex items-center gap-1.5 font-extrabold uppercase"
                  style={{
                    fontSize: "10.5px",
                    letterSpacing: "0.08em",
                    color: phaseColor,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: phaseColor }}
                    aria-hidden="true"
                  />
                  {phaseName}
                </div>
              )}
              {phaseName && (
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ background: "var(--sl-hair)" }}
                  aria-hidden="true"
                />
              )}
              <div
                className="cap"
                style={{ color: "var(--sl-ink-3)" }}
              >
                Lesson {lessonIndex} of {lessonTotal}
              </div>
              {strandLabel && (
                <>
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{ background: "var(--sl-hair)" }}
                    aria-hidden="true"
                  />
                  <div
                    className="font-bold"
                    style={{ fontSize: "10.5px", color: "var(--sl-ink-3)" }}
                  >
                    {strandLabel}
                  </div>
                </>
              )}
            </div>

            {/* Title */}
            <h1
              className="display-lg mt-4"
              style={{
                fontSize: "clamp(36px, 5.5vw, 56px)",
                lineHeight: "0.98",
                color: "var(--sl-ink)",
              }}
            >
              {accent !== null ? (
                <>
                  {before}
                  <span className="serif-em" style={{ color: phaseColor }}>
                    {accent}
                  </span>
                  {after}
                </>
              ) : (
                title
              )}
            </h1>

            {whyItMatters && (
              <p
                className="mt-4 leading-relaxed"
                style={{
                  fontSize: "15px",
                  color: "var(--sl-ink-2)",
                  maxWidth: "720px",
                }}
              >
                <span
                  className="serif-em"
                  style={{ fontSize: "17px", color: phaseColor }}
                >
                  Why this matters:
                </span>{" "}
                {whyItMatters}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
          )}
        </div>

        {/* Criterion + summative chips */}
        {(criterionChips && criterionChips.length > 0) || summative ? (
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            {criterionChips?.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 font-bold uppercase"
                style={{
                  fontSize: "10.5px",
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "var(--sl-bg)",
                  border: "1px solid var(--sl-hair)",
                  color: "var(--sl-ink-2)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: phaseColor }}
                  aria-hidden="true"
                />
                {chip.kind === "label" || chip.kind === "implicit"
                  ? `${chip.short}: ${chip.name}`
                  : chip.kind === "unknown"
                    ? chip.tag
                    : "Not assessed"}
              </span>
            ))}
            {summative && (
              <span
                className="inline-flex items-center font-bold uppercase"
                style={{
                  fontSize: "10.5px",
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: phaseColor,
                  color: "white",
                }}
              >
                Summative
              </span>
            )}
          </div>
        ) : null}

        {/* Learning objectives strip — 3-up numbered */}
        {learningObjectives && learningObjectives.length > 0 && (
          <div
            className="mt-6 grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(learningObjectives.length, 3)}, minmax(0, 1fr))`,
            }}
          >
            {learningObjectives.slice(0, 3).map((obj, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div
                  className="display tnum leading-none mt-0.5"
                  style={{ fontSize: "20px", color: phaseColor }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  className="font-semibold leading-snug"
                  style={{ fontSize: "12.5px", color: "var(--sl-ink-2)" }}
                >
                  {obj}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
