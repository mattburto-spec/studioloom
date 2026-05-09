"use client";

import React from "react";

type Props = {
  /** Current text length. */
  value: number;
  /** Soft "good answer" threshold — ring fills to here, then turns green. */
  target: number;
  /** Hard cap. */
  max: number;
  /** Active criterion color (hex) used while below target. */
  color: string;
  /** Outer dimension in px. */
  size?: number;
};

const SUCCESS = "#2DA05E";

export function ProgressRing({ value, target, max, color, size = 32 }: Props) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const targetMet = value >= target;
  const pct = targetMet
    ? Math.min(1, (value - target) / Math.max(1, max - target)) * 0.5 + 0.5
    : Math.min(1, value / Math.max(1, target)) * 0.5;

  const dash = c * pct;
  const ringColor = targetMet ? SUCCESS : color;

  const counter = `${value}/${target}`;

  return (
    <div
      className="inline-flex items-center gap-2"
      style={{ fontFamily: "var(--sl-font-sans)" }}
      aria-label={
        targetMet
          ? `Target met. ${value} of ${max} characters.`
          : `${value} of ${target} characters.`
      }
    >
      <span
        className="tnum"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: targetMet ? SUCCESS : "var(--sl-fg-secondary)",
        }}
      >
        {counter}
      </span>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 240ms ease, stroke 240ms ease" }}
        />
        {targetMet && (
          <path
            d={`M${size * 0.32} ${size * 0.52} L${size * 0.45} ${size * 0.65} L${size * 0.7} ${size * 0.38}`}
            stroke={SUCCESS}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </svg>
    </div>
  );
}
