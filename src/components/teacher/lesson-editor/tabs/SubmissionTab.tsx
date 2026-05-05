"use client";

/**
 * TG.0D.4 — Tab 2 (Submission)
 *
 * Format / word cap / AI-use policy / integrity declaration.
 */

import type { Dispatch } from "react";
import type {
  SummativeAction,
  SummativeFormState,
} from "../summative-form-state";

interface SubmissionTabProps {
  state: SummativeFormState;
  dispatch: Dispatch<SummativeAction>;
}

const FORMAT_OPTIONS: ReadonlyArray<{
  value: SummativeFormState["submission"]["format"];
  label: string;
  hint: string;
}> = [
  { value: "text", label: "Text only", hint: "In-app textbox; word cap applies" },
  { value: "upload", label: "Upload", hint: "PDF / image / model file (handled by Preflight pipeline)" },
  { value: "multi", label: "Mixed", hint: "Text + uploads in the same submission" },
];

const AI_OPTIONS: ReadonlyArray<{
  value: SummativeFormState["submission"]["ai_use_policy"];
  label: string;
  hint: string;
}> = [
  { value: "not_allowed", label: "Not allowed", hint: "Students declare zero AI use at submit" },
  { value: "allowed_with_citation", label: "Allowed with citation", hint: "Must list which AI tools and how" },
  { value: "allowed", label: "Freely allowed", hint: "No restriction" },
];

export default function SubmissionTab({
  state,
  dispatch,
}: SubmissionTabProps) {
  const s = state.submission;
  return (
    <div className="space-y-4">
      {/* Format */}
      <fieldset>
        <legend className="le-cap text-[var(--le-ink-3)] mb-1.5">Format</legend>
        <div className="space-y-1">
          {FORMAT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-2 text-[11.5px] cursor-pointer hover:bg-[var(--le-paper)] rounded p-1.5"
            >
              <input
                type="radio"
                name="submission-format"
                value={opt.value}
                checked={s.format === opt.value}
                onChange={() =>
                  dispatch({
                    type: "setSubmissionField",
                    field: "format",
                    value: opt.value,
                  })
                }
                className="mt-0.5 text-violet-600 focus:ring-violet-400"
                data-testid={`submission-format-${opt.value}`}
              />
              <span>
                <span className="font-semibold text-[var(--le-ink)]">{opt.label}</span>
                <span className="block text-[10.5px] text-[var(--le-ink-3)]">
                  {opt.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Word cap (visible only when format includes text) */}
      {(s.format === "text" || s.format === "multi") && (
        <label className="block">
          <span className="le-cap text-[var(--le-ink-3)] block mb-1">
            Word count cap (optional)
          </span>
          <input
            type="number"
            min={0}
            max={20000}
            placeholder="e.g. 500"
            value={s.word_count_cap}
            onChange={(e) =>
              dispatch({
                type: "setSubmissionField",
                field: "word_count_cap",
                value: e.target.value,
              })
            }
            className="text-[11.5px] px-2 py-1 w-32 bg-white border border-[var(--le-hair)] rounded focus:outline-none focus:border-violet-500"
            data-testid="submission-word-cap"
          />
          <span className="ml-2 text-[10.5px] text-[var(--le-ink-3)]">
            Leave blank for no cap
          </span>
        </label>
      )}

      {/* AI use policy */}
      <fieldset>
        <legend className="le-cap text-[var(--le-ink-3)] mb-1.5">
          AI use policy
        </legend>
        <div className="space-y-1">
          {AI_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-2 text-[11.5px] cursor-pointer hover:bg-[var(--le-paper)] rounded p-1.5"
            >
              <input
                type="radio"
                name="submission-ai"
                value={opt.value}
                checked={s.ai_use_policy === opt.value}
                onChange={() =>
                  dispatch({
                    type: "setSubmissionField",
                    field: "ai_use_policy",
                    value: opt.value,
                  })
                }
                className="mt-0.5 text-violet-600 focus:ring-violet-400"
                data-testid={`submission-ai-${opt.value}`}
              />
              <span>
                <span className="font-semibold text-[var(--le-ink)]">{opt.label}</span>
                <span className="block text-[10.5px] text-[var(--le-ink-3)]">
                  {opt.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Integrity declaration */}
      <label className="flex items-start gap-2 text-[11.5px] cursor-pointer">
        <input
          type="checkbox"
          checked={s.integrity_declaration_required}
          onChange={(e) =>
            dispatch({
              type: "setSubmissionField",
              field: "integrity_declaration_required",
              value: e.target.checked,
            })
          }
          className="mt-0.5 rounded text-violet-600 focus:ring-violet-400"
          data-testid="submission-integrity"
        />
        <span>
          <span className="font-semibold text-[var(--le-ink)]">
            Require integrity declaration on submit
          </span>
          <span className="block text-[10.5px] text-[var(--le-ink-3)]">
            Students tick a checkbox confirming the work is theirs (with AI
            disclosed per policy above)
          </span>
        </span>
      </label>
    </div>
  );
}
