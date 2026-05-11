"use client";

/**
 * SlotWalker — the per-question walker shell. Renders header,
 * progress bar, title/subhead, examples drawer, input dispatcher,
 * length nudge, and the back/skip/next/finish action row.
 *
 * Extracted from v1's ProjectSpecResponse during the v2 split.
 * Slot-count-agnostic via the `totalSlots` prop (5 for Success
 * Criteria, 7 for v1, 8 for User Profile, 9 for Product Brief).
 *
 * Header label is fully formed by the caller (e.g. "🧸 Toy /
 * Game Design · Question 3 of 9"), giving each block control
 * over its own header text without subclassing.
 */

import { useEffect, useMemo, useState } from "react";
import { computeLengthHint, isValueNonEmpty } from "@/lib/project-spec/format";
import type {
  SlotAnswer,
  SlotDefinition,
  SlotValue,
} from "@/lib/project-spec/archetypes";
import { SlotInput } from "./SlotInput";

interface SlotWalkerProps {
  /**
   * Full header line shown above the progress bar
   * (e.g. "🧸 Toy / Game Design · Question 3 of 9", or just
   * "Question 3 of 5" for blocks without an archetype).
   */
  headerLabel: string;
  /** Total slot count — drives the progress bar percentage + "Finish" CTA on the last slot. */
  totalSlots: number;
  slotDef: SlotDefinition;
  slotIndex: number;
  currentAnswer: SlotAnswer | null | undefined;
  saving: boolean;
  onSave: (answer: SlotAnswer) => Promise<void>;
  onBack: (() => void) | null;
  /** Non-null on the last slot — clicking finish saves the current answer + marks the block complete. */
  onComplete: (() => Promise<void>) | null;
}

export function SlotWalker({
  headerLabel,
  totalSlots,
  slotDef,
  slotIndex,
  currentAnswer,
  saving,
  onSave,
  onBack,
  onComplete,
}: SlotWalkerProps) {
  const [draftValue, setDraftValue] = useState<SlotValue | null>(
    currentAnswer && !currentAnswer.skipped ? currentAnswer.value ?? null : null,
  );
  const [showExamples, setShowExamples] = useState(false);

  // Re-sync draft when slot changes
  useEffect(() => {
    setDraftValue(
      currentAnswer && !currentAnswer.skipped
        ? currentAnswer.value ?? null
        : null,
    );
    setShowExamples(false);
  }, [slotIndex, currentAnswer]);

  const progress = ((slotIndex + 1) / totalSlots) * 100;

  const lengthHint = useMemo(
    () => computeLengthHint(slotDef.input, draftValue),
    [slotDef.input, draftValue],
  );

  const canAdvance = draftValue !== null && isValueNonEmpty(draftValue);

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-purple-50/40 to-white p-6">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
          {headerLabel}
        </span>
        {slotDef.examples && (
          <button
            onClick={() => setShowExamples((s) => !s)}
            className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
          >
            {showExamples ? "Hide examples" : "🔍 Strong vs weak examples"}
          </button>
        )}
      </div>
      {/* Progress bar */}
      <div className="h-1 w-full bg-purple-100 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-purple-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-1">
        {slotDef.title}
      </h3>
      <p className="text-sm text-gray-600 mb-4">{slotDef.subhead}</p>

      {/* Examples drawer */}
      {showExamples && slotDef.examples && (
        <div className="mb-4 rounded-lg border border-purple-200 bg-white p-3 text-sm">
          {slotDef.examples.strong.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">
                Strong
              </p>
              <ul className="mb-3 space-y-0.5 text-gray-700 list-disc list-inside">
                {slotDef.examples.strong.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {slotDef.examples.weak.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-1">
                Weak
              </p>
              <ul className="space-y-0.5 text-gray-700 list-disc list-inside">
                {slotDef.examples.weak.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Input */}
      <SlotInput
        input={slotDef.input}
        value={draftValue}
        onChange={setDraftValue}
      />

      {/* Length nudge */}
      {lengthHint && (
        <p className="mt-2 text-xs text-amber-700">{lengthHint}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-5 gap-2 flex-wrap">
        <div className="flex gap-2">
          {onBack && (
            <button
              onClick={onBack}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          <button
            onClick={async () => {
              await onSave({
                skipped: true,
                updated_at: new Date().toISOString(),
              });
            }}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
          >
            Skip for now →
          </button>
        </div>
        {onComplete ? (
          <button
            onClick={async () => {
              if (canAdvance && draftValue) {
                await onSave({
                  value: draftValue,
                  skipped: false,
                  updated_at: new Date().toISOString(),
                });
              }
              await onComplete();
            }}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Finish &amp; see summary →
          </button>
        ) : (
          <button
            onClick={async () => {
              if (!draftValue) return;
              await onSave({
                value: draftValue,
                skipped: false,
                updated_at: new Date().toISOString(),
              });
            }}
            disabled={saving || !canAdvance}
            className="px-5 py-2.5 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
