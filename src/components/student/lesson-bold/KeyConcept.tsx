"use client";

import React from "react";

export type KeyConceptQuadrant = {
  /** Short label, e.g. "Says", "Thinks". Rendered at display size. */
  label: string;
  /** One-line description under the label. */
  note: string;
  /** Illustrative example — rendered in italic serif. */
  example: string;
  /** Hex color for the label + left accent border on the example chip. */
  color: string;
};

type Props = {
  /** Title JSX — caller wraps accented words in <span className="serif-em">…</span>. */
  title: React.ReactNode;
  /** Small uppercase label above the title. Defaults to "Key concept". */
  eyebrow?: string;
  /** Optional 4-quadrant grid. When omitted, renders just title + children. */
  quadrants?: KeyConceptQuadrant[];
  /** Optional trailing copy below the grid. */
  children?: React.ReactNode;
};

function FlagIcon({ size = 14 }: { size?: number }) {
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
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22V15" />
    </svg>
  );
}

export function KeyConcept({ title, eyebrow = "Key concept", quadrants, children }: Props) {
  return (
    <div className="card-lb" style={{ padding: "28px" }}>
      <div className="flex items-center gap-2 mb-4" style={{ color: "var(--sl-ink-3)" }}>
        <FlagIcon />
        <div className="cap">{eyebrow}</div>
      </div>

      <div
        className="display leading-tight"
        style={{
          fontSize: "28px",
          maxWidth: "680px",
          color: "var(--sl-ink)",
        }}
      >
        {title}
      </div>

      {quadrants && quadrants.length > 0 && (
        <div
          className="mt-6 grid grid-cols-2 overflow-hidden"
          style={{ border: "1px solid var(--sl-hair)", borderRadius: "16px" }}
        >
          {quadrants.map((q, i) => (
            <div
              key={q.label}
              style={{
                background: "var(--sl-paper)",
                padding: "20px",
                borderRight: i % 2 === 0 ? "1px solid var(--sl-hair)" : "none",
                borderBottom: i < 2 ? "1px solid var(--sl-hair)" : "none",
              }}
              data-quadrant-label={q.label}
            >
              <div className="flex items-center gap-2">
                <div
                  className="display leading-none"
                  style={{ fontSize: "24px", color: q.color }}
                >
                  {q.label}
                </div>
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ background: "var(--sl-hair)" }}
                  aria-hidden="true"
                />
                <div className="cap" style={{ color: "var(--sl-ink-3)" }}>
                  Quadrant
                </div>
              </div>
              <div
                className="font-semibold leading-snug mt-1.5"
                style={{ fontSize: "12.5px", color: "var(--sl-ink-2)" }}
              >
                {q.note}
              </div>
              <div
                className="serif-em mt-3 rounded-lg"
                style={{
                  fontSize: "11.5px",
                  color: "var(--sl-ink)",
                  background: "var(--sl-bg)",
                  padding: "10px",
                  borderLeft: `2px solid ${q.color}`,
                }}
              >
                {q.example}
              </div>
            </div>
          ))}
        </div>
      )}

      {children && (
        <div
          className="mt-5 leading-relaxed"
          style={{ fontSize: "13px", color: "var(--sl-ink-2)", maxWidth: "720px" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
