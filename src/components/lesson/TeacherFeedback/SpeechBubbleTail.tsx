/**
 * SpeechBubbleTail — SVG drip that anchors the teacher bubble to the
 * student response card above it.
 *
 * Designer spec (TFL.2 Pass A, 10 May 2026): 48×26px drip drawn with
 * cubic curves so it reads as a soft drip rather than a hard triangle.
 * Positioned `top: -22px; left: 28px;` on the bubble. A 4px tall rect
 * at the bottom of the SVG masks the seam where the tail meets the
 * bubble border.
 *
 * Variants: emerald (teacher) and purple (forward-compat — if a future
 * design ever surfaces a student-led bubble, swap the variant).
 */

"use client";

import * as React from "react";

interface SpeechBubbleTailProps {
  /** Which voice the tail belongs to. Drives the fill + stroke. */
  variant?: "teacher" | "student";
  /** Optional className for layout positioning. The default places
   *  the tail top-left of the parent — pass overrides for custom
   *  anchoring. */
  className?: string;
}

const VARIANT_TOKENS = {
  teacher: {
    // emerald-50 fill (matches mint bubble bg), emerald-500 stroke.
    fill: "#ECFDF5",
    stroke: "#10B981",
    seamMask: "#ECFDF5",
  },
  student: {
    // purple-50 fill, purple-500 stroke (future use).
    fill: "#FAF5FF",
    stroke: "#A855F7",
    seamMask: "#FAF5FF",
  },
} as const;

export function SpeechBubbleTail({
  variant = "teacher",
  className = "absolute -top-[22px] left-7 pointer-events-none",
}: SpeechBubbleTailProps) {
  const tokens = VARIANT_TOKENS[variant];
  return (
    <svg
      width="48"
      height="26"
      viewBox="0 0 48 26"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 26 C 6 26, 10 22, 14 14 C 18 6, 22 2, 26 2 C 30 2, 32 6, 34 12 C 36 20, 42 26, 48 26 Z"
        fill={tokens.fill}
        stroke={tokens.stroke}
        strokeWidth={1.5}
      />
      {/* Seam mask: 4px tall rect at the bottom hides where the tail
          meets the bubble's top border. Without this the bubble's
          stroke would draw a horizontal line cutting across the drip. */}
      <rect
        x="0"
        y="22"
        width="48"
        height="4"
        fill={tokens.seamMask}
      />
    </svg>
  );
}
