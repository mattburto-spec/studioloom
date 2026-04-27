"use client";

import React from "react";
import { derivePhaseState } from "./helpers";

export type PhaseStripPhase = {
  id: string;
  name: string;
  done?: boolean;
  current?: boolean;
};

type Props = {
  phases: PhaseStripPhase[];
  /** Accent for the current phase. Defaults to the --sl-phase-default token. */
  accentColor?: string;
};

/** Local inline SVG icon helper — project does not use lucide-react (Lesson #16). */
function TickIcon({ size = 10 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function PhaseStrip({ phases, accentColor = "var(--sl-phase-default)" }: Props) {
  return (
    <div
      className="card-lb flex items-center gap-2"
      style={{ padding: "14px" }}
      role="list"
      aria-label="Lesson phase progress"
    >
      {phases.map((p, i) => {
        const isLast = i === phases.length - 1;
        const state = derivePhaseState(p);
        const circleStyle =
          state === "done"
            ? { background: "#0F766E", color: "white" }
            : state === "current"
              ? {
                  background: accentColor,
                  color: "white",
                  boxShadow: `0 0 0 3px ${accentColor}25`,
                }
              : {
                  background: "transparent",
                  color: "var(--sl-ink-3)",
                  border: "1.5px solid var(--sl-hair)",
                };
        const labelStyle =
          state === "current"
            ? { color: accentColor }
            : state === "done"
              ? { color: "var(--sl-ink-2)" }
              : { color: "var(--sl-ink-3)" };

        return (
          <React.Fragment key={p.id}>
            <div
              className="flex items-center gap-1.5 flex-shrink-0"
              role="listitem"
              aria-current={state === "current" ? "step" : undefined}
              data-phase-state={state}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold"
                style={{ fontSize: "9px", ...circleStyle }}
                aria-hidden="true"
              >
                {state === "done" ? <TickIcon size={10} /> : i + 1}
              </div>
              <div
                className="font-extrabold whitespace-nowrap"
                style={{ fontSize: "10.5px", ...labelStyle }}
              >
                {p.name}
              </div>
            </div>
            {!isLast && <div className="h-px flex-1" style={{ background: "var(--sl-hair)" }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
