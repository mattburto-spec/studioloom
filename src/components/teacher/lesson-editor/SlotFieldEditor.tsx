"use client";

/**
 * Lever 1 sub-phase 1F — three-box slot editor for activity prompts.
 *
 * Surfaces framing / task / success_signal as separately labeled
 * textareas with live char counts + soft-warning at the v2 caps. Each
 * onChange propagates to the parent ActivityBlock via onUpdate, which
 * also auto-syncs the legacy `prompt` field (composed from the three
 * slots) so non-migrated readers (grading tile titles, Pulse repair,
 * etc.) keep seeing the right text until 1H sweeps them.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 * Style: docs/specs/lesson-content-style-guide-v2-draft.md
 *
 * Caps mirror src/lib/lever-1/validate-slot-fields.ts:
 *   framing         200 (hard — server rejects)
 *   task            800 (soft — warns)
 *   success_signal  200 (hard — server rejects)
 */

import { ComposedPrompt } from "@/components/student/ComposedPrompt";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";
import type { ActivitySection } from "@/types";

interface SlotFieldEditorProps {
  activity: ActivitySection;
  onUpdate: (partial: Partial<ActivitySection>) => void;
}

interface SlotConfig {
  key: "framing" | "task" | "success_signal";
  label: string;
  hint: string;
  placeholder: string;
  cap: number;
  capKind: "hard" | "soft";
  rows: number;
}

const SLOTS: SlotConfig[] = [
  {
    key: "framing",
    label: "Framing",
    hint: "One sentence — what students are doing and why it matters today",
    placeholder: "Today we close the loop on Newton's laws and bring wheels into focus.",
    cap: 200,
    capKind: "hard",
    rows: 2,
  },
  {
    key: "task",
    label: "Task",
    hint: "The imperative body — bulleted/numbered list when there are discrete steps",
    placeholder:
      "1. Roll each of the three sample racers down the ramp.\n2. For each, record what works, what limits performance, and what surprises you.\n3. Compare the configurations side by side.",
    cap: 800,
    capKind: "soft",
    rows: 6,
  },
  {
    key: "success_signal",
    label: "Success signal",
    hint: "What students produce, record, submit or share so they know they're done",
    placeholder: "Submit one sentence: which configuration was fastest, and why?",
    cap: 200,
    capKind: "hard",
    rows: 2,
  },
];

export function SlotFieldEditor({ activity, onUpdate }: SlotFieldEditorProps) {
  function updateSlot(slot: SlotConfig["key"], value: string) {
    // Compute the next ActivitySection shape, then derive the legacy
    // prompt from it so non-migrated readers keep seeing the right text.
    const next: ActivitySection = { ...activity, [slot]: value };
    const composedLegacy = composedPromptText(next);
    onUpdate({ [slot]: value, prompt: composedLegacy } as Partial<ActivitySection>);
  }

  return (
    <div className="space-y-3">
      {SLOTS.map((slot) => {
        const value = (activity[slot.key] || "") as string;
        const len = value.length;
        const overCap = len > slot.cap;
        const capPctClass =
          len === 0
            ? "text-[var(--le-ink-3)]"
            : !overCap
            ? "text-[var(--le-ink-3)]"
            : slot.capKind === "hard"
            ? "text-rose-600 font-semibold"
            : "text-amber-600 font-semibold";
        return (
          <div key={slot.key}>
            <div className="flex items-baseline justify-between mb-0.5">
              <label
                htmlFor={`slot-${slot.key}`}
                className="text-[10px] le-cap text-[var(--le-ink-3)]"
              >
                {slot.label}
              </label>
              <span className={`text-[10px] tabular-nums ${capPctClass}`}>
                {len} / {slot.cap}
                {overCap && (
                  <span className="ml-1">
                    {slot.capKind === "hard" ? "· too long" : "· over soft cap"}
                  </span>
                )}
              </span>
            </div>
            <p className="text-[10.5px] text-[var(--le-ink-3)] mb-1 italic">
              {slot.hint}
            </p>
            <textarea
              id={`slot-${slot.key}`}
              value={value}
              onChange={(e) => updateSlot(slot.key, e.target.value)}
              placeholder={slot.placeholder}
              rows={slot.rows}
              className={`w-full px-3 py-2 text-[12.5px] leading-relaxed bg-[var(--le-bg)] border rounded-md text-[var(--le-ink-2)] focus:outline-none focus:border-[var(--le-ink-2)] ${
                overCap && slot.capKind === "hard"
                  ? "border-rose-300"
                  : "border-[var(--le-hair)]"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * SlotPreview — renders the activity exactly as students see it via the
 * shared ComposedPrompt component. Falls back to legacy prompt when
 * all three slots are empty (handled inside ComposedPrompt).
 *
 * Wraps the renderer in a lightweight container so the preview
 * surface inside the editor matches the warm-paper editor chrome
 * (the live student page uses different background tokens).
 */
export function SlotPreview({ activity }: { activity: ActivitySection }) {
  const isEmpty =
    !activity.framing &&
    !activity.task &&
    !activity.success_signal &&
    !activity.prompt;
  if (isEmpty) {
    return (
      <span className="italic text-[var(--le-ink-3)]">
        Nothing to preview yet — fill the three boxes above.
      </span>
    );
  }
  return <ComposedPrompt section={activity} variant="compact" />;
}
