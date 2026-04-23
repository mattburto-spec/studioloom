"use client";

/**
 * RuleCard — single-rule display for Phase 5-3 results viewer.
 *
 * Three visual variants driven by severity:
 *   - block (must-fix):  red-tinted, static, no interaction
 *   - warn (should-fix): amber-tinted, 3-option radio group for ack
 *   - fyi:               grey-tinted, static
 *
 * Controlled component — parent owns ack state. RuleCard just
 * announces radio changes via onAcknowledge(ruleId, choice).
 *
 * Skills Library deep-link renders when the rule id matches the
 * expected R-{STL|SVG}-NN convention. Phase 5-6 will flesh out the
 * hover/disabled styling when the library catalogue populates.
 */

import * as React from "react";
import Link from "next/link";
import type { Rule } from "@/lib/fabrication/rule-buckets";
import type { AckChoice } from "@/lib/fabrication/orchestration";
import {
  severityDisplay,
  skillsLibraryUrl,
  formatEvidence,
  ackOptionLabelsForFileType,
  ACK_OPTION_ORDER,
} from "./rule-card-helpers";

export interface RuleCardProps {
  rule: Rule;
  /** For should-fix rules only: current persisted ack choice for this rev.
   *  undefined = not yet acked. Ignored for block/fyi. */
  currentChoice?: AckChoice;
  /** Called when student picks a radio. Only fires for should-fix. */
  onAcknowledge?: (ruleId: string, choice: AckChoice) => void;
  /** Disable interaction (during a submit or ack in flight). */
  disabled?: boolean;
  /** Phase 5-5b (post-Checkpoint-5.1 smoke fix): drives the fileType-
   *  aware middle ack label so SVG rules don't talk about "slicer".
   *  Defaults to 'stl' for backwards compat. */
  fileType?: "stl" | "svg";
  /** Phase 6-2 (teacher view): when true, radios render checked if the
   *  student acked but interaction is disabled. Also suppresses
   *  onAcknowledge firing. Combined with ScanResultsViewer's readOnly. */
  readOnly?: boolean;
}

export function RuleCard({
  rule,
  currentChoice,
  onAcknowledge,
  disabled = false,
  fileType = "stl",
  readOnly = false,
}: RuleCardProps) {
  const ackLabels = ackOptionLabelsForFileType(fileType);
  const interactionDisabled = disabled || readOnly;
  const display = severityDisplay(rule.severity);
  const skillsUrl = skillsLibraryUrl(rule.id);
  const evidenceText = formatEvidence(rule.evidence);

  return (
    <div className={`rounded-xl border p-5 ${display.tintClass}`}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${display.badgeClass}`}
          >
            {display.label}
          </span>
          <code className="text-xs text-gray-500 font-mono">{rule.id}</code>
        </div>
        {rule.title && (
          <h3 className="text-base font-semibold text-gray-900">{rule.title}</h3>
        )}
        {rule.explanation && (
          <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">
            {rule.explanation}
          </p>
        )}
        {rule.fix_hint && rule.severity !== "fyi" && (
          <p className="text-sm text-gray-700 mt-3">
            <span className="font-semibold">How to fix:</span> {rule.fix_hint}
          </p>
        )}
        {evidenceText && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer select-none">
              Evidence
            </summary>
            <pre className="mt-1 text-xs font-mono bg-white/60 rounded p-2 overflow-x-auto">
              {evidenceText}
            </pre>
          </details>
        )}

        {/* Should-fix: ack radio group (interactive for students;
            read-only view of student's choice for teachers) */}
        {rule.severity === "warn" && (onAcknowledge || readOnly) && (
          <fieldset className="mt-4" disabled={interactionDisabled}>
            <legend className="sr-only">
              {readOnly
                ? `Student acknowledgement for ${rule.id}`
                : `Acknowledge ${rule.id}`}
            </legend>
            <div className="space-y-2">
              {ACK_OPTION_ORDER.map((choice) => {
                const checked = currentChoice === choice;
                return (
                  <label
                    key={choice}
                    className={`flex items-start gap-2 text-sm ${
                      interactionDisabled
                        ? "opacity-70 cursor-default"
                        : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`ack-${rule.id}`}
                      value={choice}
                      checked={checked}
                      onChange={() => {
                        if (!readOnly && onAcknowledge) {
                          onAcknowledge(rule.id, choice);
                        }
                      }}
                      disabled={interactionDisabled}
                      className="mt-0.5"
                    />
                    <span className="text-gray-800">
                      {ackLabels[choice]}
                    </span>
                  </label>
                );
              })}
            </div>
            {readOnly && !currentChoice && (
              <p className="text-xs text-gray-500 italic mt-2">
                Student has not acknowledged this warning yet.
              </p>
            )}
          </fieldset>
        )}

        {/* Skills Library deep-link stub */}
        {skillsUrl && (
          <div className="mt-3">
            <Link
              href={skillsUrl}
              className="text-xs text-brand-purple underline hover:no-underline"
            >
              Learn more in Skills Library →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default RuleCard;
