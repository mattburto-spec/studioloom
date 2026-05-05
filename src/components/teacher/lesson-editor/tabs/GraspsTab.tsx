"use client";

/**
 * TG.0D.4 — Tab 1 (GRASPS)
 *
 * Wiggins/McTighe authentic-task framing. 6 textareas in vertical stack.
 * Mini-help at top: a teacher who's never written GRASPS gets it presented
 * FIRST (Tasks v1 Friction Moment 03 — "the UI taught her the practice").
 */

import type { Dispatch } from "react";
import type {
  SummativeAction,
  SummativeFormState,
} from "../summative-form-state";

const FIELDS: ReadonlyArray<{
  key: keyof SummativeFormState["grasps"];
  label: string;
  placeholder: string;
}> = [
  {
    key: "goal",
    label: "Goal",
    placeholder: "e.g. Design a roller coaster brief that demonstrates Newton's 2nd law",
  },
  {
    key: "role",
    label: "Role",
    placeholder: "e.g. Engineer pitching to a theme-park investor",
  },
  {
    key: "audience",
    label: "Audience",
    placeholder: "e.g. Year 7 peers serving as the investor panel",
  },
  {
    key: "situation",
    label: "Situation",
    placeholder: "e.g. School STEM showcase, 3-min pitch + Q&A",
  },
  {
    key: "performance",
    label: "Performance",
    placeholder: "e.g. Annotated sketches + working physical or digital model",
  },
  {
    key: "standards",
    label: "Standards",
    placeholder: "e.g. Functional, creative, evidence-based reasoning",
  },
];

interface GraspsTabProps {
  state: SummativeFormState;
  dispatch: Dispatch<SummativeAction>;
}

export default function GraspsTab({ state, dispatch }: GraspsTabProps) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[var(--le-ink-3)] leading-snug pb-1 border-b border-[var(--le-hair)]">
        <strong className="text-[var(--le-ink)]">Backward design.</strong> Spell out the authentic task before configuring rubric or submission. Each field gives students context they wouldn&apos;t infer from a one-line prompt.
      </div>
      {FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="le-cap text-[var(--le-ink-3)] block mb-1">
            {f.label}
          </span>
          <textarea
            rows={2}
            placeholder={f.placeholder}
            value={state.grasps[f.key]}
            onChange={(e) =>
              dispatch({
                type: "setGraspsField",
                field: f.key,
                value: e.target.value,
              })
            }
            maxLength={1000}
            className="w-full text-[11.5px] px-2 py-1.5 bg-white border border-[var(--le-hair)] rounded resize-y focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
            data-testid={`grasps-${f.key}`}
          />
        </label>
      ))}
    </div>
  );
}
