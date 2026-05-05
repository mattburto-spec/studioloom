"use client";

/**
 * TG.0D.4 — Tab 3 (Rubric)
 *
 * Criterion picker (multi-select pills via FrameworkAdapter) +
 * per-criterion descriptors at 4 achievement levels +
 * self-assessment toggle (locked-on by default per OQ-3).
 *
 * Self-assessment nudge copy is the didactic version Matt OK'd in the
 * brief defaults: "Hattie's research shows it's the highest-effect
 * feedback mechanism we have (d=1.33). Disable only if you've
 * discussed reasons with students."
 */

import type { Dispatch } from "react";
import {
  getCriterionLabels,
  type FrameworkId,
} from "@/lib/frameworks/adapter";
import type { NeutralCriterionKey } from "@/lib/pipeline/stages/stage4-neutral-validator";
import type {
  RubricDescriptors,
  SummativeAction,
  SummativeFormState,
} from "../summative-form-state";

interface RubricTabProps {
  state: SummativeFormState;
  dispatch: Dispatch<SummativeAction>;
  framework?: string | null;
}

const LEVEL_LABELS: ReadonlyArray<{
  key: keyof RubricDescriptors;
  label: string;
}> = [
  { key: "level1_2", label: "1–2 (limited)" },
  { key: "level3_4", label: "3–4 (adequate)" },
  { key: "level5_6", label: "5–6 (substantial)" },
  { key: "level7_8", label: "7–8 (excellent)" },
];

export default function RubricTab({
  state,
  dispatch,
  framework,
}: RubricTabProps) {
  const availableCriteria = (() => {
    if (!framework) return [];
    try {
      return getCriterionLabels(framework as FrameworkId);
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-4">
      {/* Self-assessment toggle (top — Hattie d=1.33 nudge) */}
      <label
        className={[
          "flex items-start gap-2 p-2 rounded text-[11.5px] cursor-pointer border",
          state.self_assessment_required
            ? "bg-violet-50 border-violet-200"
            : "bg-amber-50 border-amber-200",
        ].join(" ")}
      >
        <input
          type="checkbox"
          checked={state.self_assessment_required}
          onChange={(e) =>
            dispatch({
              type: "setSelfAssessmentRequired",
              required: e.target.checked,
            })
          }
          className="mt-0.5 rounded text-violet-600 focus:ring-violet-400"
          data-testid="rubric-self-assessment-toggle"
        />
        <span>
          <span className="font-semibold text-[var(--le-ink)]">
            Self-assessment required before submit{" "}
            <span className="text-[10px] font-normal text-[var(--le-ink-3)]">
              (locked-on by default)
            </span>
          </span>
          <span className="block text-[10.5px] text-[var(--le-ink-2)] mt-0.5">
            Hattie&apos;s research shows it&apos;s the highest-effect feedback
            mechanism we have (d=1.33). Disable only if you&apos;ve discussed
            reasons with students.
          </span>
        </span>
      </label>

      {/* Criterion picker */}
      <fieldset>
        <legend className="le-cap text-[var(--le-ink-3)] mb-1.5">
          Criteria assessed
        </legend>
        {availableCriteria.length === 0 ? (
          <div className="text-[10.5px] text-rose-500 italic">
            No framework set on this class — set framework to pick criteria
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {availableCriteria.map((def) => {
              // Use neutralKeys[0] as the representative — same convention
              // as QuickCheckRow.
              const neutralKey = def.neutralKeys[0] as NeutralCriterionKey;
              const selected = state.criteria.some((c) => c.key === neutralKey);
              return (
                <button
                  key={def.short}
                  type="button"
                  onClick={() =>
                    selected
                      ? dispatch({ type: "removeCriterion", key: neutralKey })
                      : dispatch({ type: "addCriterion", key: neutralKey })
                  }
                  className={[
                    "text-[10.5px] px-2 py-0.5 rounded-full border",
                    selected
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-[var(--le-ink)] border-[var(--le-hair)] hover:border-violet-400",
                  ].join(" ")}
                  title={def.full}
                  data-testid={`rubric-criterion-${def.short}`}
                >
                  {def.short}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      {/* Per-criterion descriptors */}
      {state.criteria.length === 0 && (
        <div className="text-[10.5px] text-rose-500 italic">
          Add at least one criterion to define descriptors
        </div>
      )}
      {state.criteria.map((c) => (
        <div
          key={c.key}
          className="border border-[var(--le-hair)] rounded p-2 space-y-2"
          data-testid={`rubric-descriptors-${c.key}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-[11.5px] text-[var(--le-ink)] capitalize">
              {c.key.replace(/_/g, " ")}
            </div>
            <label className="flex items-center gap-1 text-[10px] text-[var(--le-ink-3)]">
              Weight
              <input
                type="number"
                min={0}
                max={100}
                value={c.weight}
                onChange={(e) =>
                  dispatch({
                    type: "setCriterionWeight",
                    key: c.key,
                    weight: Number(e.target.value) || 0,
                  })
                }
                className="w-12 px-1 py-0.5 text-right bg-white border border-[var(--le-hair)] rounded focus:outline-none focus:border-violet-500"
                data-testid={`rubric-weight-${c.key}`}
              />
            </label>
          </div>
          {LEVEL_LABELS.map((l) => (
            <label key={l.key} className="block">
              <span className="text-[10px] text-[var(--le-ink-3)] block mb-0.5">
                {l.label}
              </span>
              <textarea
                rows={1}
                placeholder={`What does ${l.label.toLowerCase()} look like for ${c.key}?`}
                value={c.descriptors[l.key]}
                onChange={(e) =>
                  dispatch({
                    type: "setRubricDescriptor",
                    key: c.key,
                    level: l.key,
                    value: e.target.value,
                  })
                }
                className="w-full text-[11px] px-2 py-1 bg-white border border-[var(--le-hair)] rounded resize-y focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                data-testid={`rubric-descriptor-${c.key}-${l.key}`}
              />
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
