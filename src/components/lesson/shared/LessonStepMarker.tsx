"use client";

import React from "react";

type Props = {
  /** The number rendered inside the circle. */
  step: number | string;
  /** Optional override of the marker color. Defaults to brand purple. */
  color?: string;
  className?: string;
};

/**
 * Section divider used between lesson surfaces — a small filled circle
 * carrying the step number, flanked by a hairline rule on each side.
 */
export function LessonStepMarker({
  step,
  color = "var(--sl-primary)",
  className = "",
}: Props) {
  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      role="separator"
      aria-label={`Step ${step}`}
    >
      <div
        className="flex-1 h-px"
        style={{ background: "var(--sl-hairline)" }}
        aria-hidden="true"
      />
      <div
        className="inline-flex items-center justify-center text-white"
        style={{
          width: 28,
          height: 28,
          borderRadius: "var(--sl-radius-pill)",
          background: color,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "var(--sl-font-sans)",
          letterSpacing: "-0.01em",
        }}
      >
        {step}
      </div>
      <div
        className="flex-1 h-px"
        style={{ background: "var(--sl-hairline)" }}
        aria-hidden="true"
      />
    </div>
  );
}
