"use client";

import React from "react";
import { AUTONOMY_LEVELS, isLevelSelected, type AutonomyLevel } from "./helpers";

export type { AutonomyLevel };

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

type Props = {
  value: AutonomyLevel | null;
  onChange: (level: AutonomyLevel) => void;
  /** Optional duration badge in the header, e.g. "35 min". */
  durationLabel?: string;
};

export function AutonomyPicker({ value, onChange, durationLabel }: Props) {
  return (
    <div className="card-lb" style={{ padding: "20px" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="cap" style={{ color: "var(--sl-ink-3)" }}>
            Before you start
          </div>
          <div
            className="display leading-tight mt-1"
            style={{ fontSize: "20px", color: "var(--sl-ink)" }}
          >
            How do you want to work today?
          </div>
        </div>
        {durationLabel && (
          <div
            className="inline-flex items-center gap-1.5 font-extrabold"
            style={{ fontSize: "10.5px", color: "var(--sl-ink-3)" }}
          >
            <ClockIcon />
            {durationLabel}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {AUTONOMY_LEVELS.map((l) => {
          const selected = isLevelSelected(value, l.id);
          const baseStyle = selected
            ? { background: l.color, color: "white" }
            : { background: "var(--sl-bg)" };
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange(l.id)}
              className="text-left rounded-2xl transition"
              style={{
                padding: "16px",
                ...baseStyle,
              }}
              aria-pressed={selected}
              data-level={l.id}
              data-selected={selected ? "true" : "false"}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    border: selected ? "2px solid white" : "2px solid var(--sl-ink-3)",
                    background: selected ? "white" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-hidden="true"
                >
                  {selected && (
                    <div
                      className="w-full h-full rounded-full"
                      style={{ background: l.color, transform: "scale(0.5)" }}
                    />
                  )}
                </div>
                <div
                  className="font-extrabold uppercase"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    color: selected ? "rgba(255,255,255,0.85)" : l.color,
                  }}
                >
                  {l.id}
                </div>
              </div>
              <div
                className="display leading-tight mt-2"
                style={{
                  fontSize: "16px",
                  color: selected ? "white" : "var(--sl-ink)",
                }}
              >
                {l.name}
              </div>
              <div
                className="mt-1.5 leading-snug"
                style={{
                  fontSize: "11px",
                  color: selected ? "rgba(255,255,255,0.85)" : "var(--sl-ink-3)",
                }}
              >
                {l.sub}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
