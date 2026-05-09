"use client";

import React from "react";
import { CRITERION_HEX, type MultiQuestionField } from "./types";

export type StepStatus = "idle" | "current" | "complete";

type Props = {
  fields: Pick<MultiQuestionField, "id" | "criterion" | "label">[];
  /** 0-indexed currently-focused step. */
  activeIndex: number;
  /** Per-field completion flags (length matches fields). */
  complete: boolean[];
  onJump: (index: number) => void;
};

const SUCCESS = "#2DA05E";
const IDLE = "#E5E7EB";

export function StepStrip({ fields, activeIndex, complete, onJump }: Props) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label="Reflection steps"
    >
      {fields.map((field, i) => {
        const isCurrent = i === activeIndex;
        const isComplete = complete[i] ?? false;
        const color = isComplete
          ? SUCCESS
          : isCurrent
          ? CRITERION_HEX[field.criterion]
          : IDLE;
        const status: StepStatus = isComplete
          ? "complete"
          : isCurrent
          ? "current"
          : "idle";
        const labelTxt = `${field.criterion} — ${field.label.replace(/\?$/, "")}`;

        return (
          <button
            key={field.id}
            type="button"
            onClick={() => onJump(i)}
            aria-current={isCurrent ? "step" : undefined}
            aria-label={labelTxt}
            data-status={status}
            className="group relative flex-1 cursor-pointer"
            style={{
              background: "transparent",
              border: 0,
              padding: "8px 0",
              minWidth: 0,
            }}
          >
            <div
              style={{
                height: 4,
                borderRadius: "var(--sl-radius-pill)",
                background: color,
                transition: "background 200ms ease, transform 200ms ease",
                transform: isCurrent ? "scaleY(1.4)" : "scaleY(1)",
                transformOrigin: "center",
              }}
            />
            <div
              className="mt-2 cap"
              style={{
                fontSize: "10.5px",
                letterSpacing: "0.08em",
                fontWeight: 700,
                fontFamily: "var(--sl-font-sans)",
                color: isCurrent || isComplete ? color : "var(--sl-fg-secondary)",
                textTransform: "uppercase",
              }}
            >
              <span className="tnum">{String(i + 1).padStart(2, "0")}</span>
              {" · "}
              {field.criterion}
            </div>
          </button>
        );
      })}
    </div>
  );
}
