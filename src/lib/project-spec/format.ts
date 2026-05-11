/**
 * Shared formatting helpers for the Project Spec block family.
 *
 * Extracted from v1's ProjectSpecResponse during the v2 split (see
 * docs/projects/project-spec-v2-split-brief.md). Consumed by v1's
 * ProjectSpecResponse + the three v2 blocks (Product Brief / User
 * Profile / Success Criteria).
 *
 * Slot-count agnostic — callers pass arrays of (slotDef, answer)
 * entries, not whole state objects.
 */

import type {
  SlotAnswer,
  SlotDefinition,
  SlotInputType,
  SlotValue,
} from "./archetypes";

/** True when the slot value has some content (non-empty / non-NaN). */
export function isValueNonEmpty(v: SlotValue): boolean {
  switch (v.kind) {
    case "text":
      return v.text.trim().length > 0;
    case "text-multifield":
      return v.values.some((s) => s.trim().length > 0);
    case "chip":
      return Boolean(v.primary);
    case "size":
      return Boolean(v.ref);
    case "pair":
      return Number.isFinite(v.first) && Number.isFinite(v.second);
  }
}

/** Returns a soft nudge string for short / over-cap text values. Null otherwise. */
export function computeLengthHint(
  input: SlotInputType,
  value: SlotValue | null,
): string | null {
  if (!value) return null;
  if (input.kind === "text" && value.kind === "text") {
    const txt = value.text.trim();
    if (txt.length === 0) return null;
    if (txt.length < 10) {
      return "This feels thin. Try once more, or skip and come back?";
    }
    if (input.maxWords) {
      const words = txt.split(/\s+/).filter(Boolean).length;
      if (words > input.maxWords) {
        return `${words} words — aim for ${input.maxWords} or fewer.`;
      }
    }
  }
  return null;
}

/** Format a single slot answer as readable plaintext, given the input shape. */
export function formatAnswer(answer: SlotAnswer, input: SlotInputType): string {
  const v = answer.value;
  if (!v) return "—";
  switch (v.kind) {
    case "text":
      return v.text;
    case "text-multifield":
      return v.values.filter((s) => s.trim().length > 0).join(" · ");
    case "chip": {
      if (input.kind !== "chip-picker") return v.primary;
      const primaryChip = input.chips.find((c) => c.id === v.primary);
      const primary = primaryChip
        ? `${primaryChip.emoji ?? ""} ${primaryChip.label}`.trim()
        : v.primary;
      if (!v.secondary) return primary;
      const secChip = input.allowSecondary?.chips.find(
        (c) => c.id === v.secondary,
      );
      return `${primary} + ${secChip?.label ?? v.secondary}`;
    }
    case "size": {
      if (input.kind !== "size-reference") return v.ref;
      const refLabel =
        input.references.find((r) => r.id === v.ref)?.label ?? v.ref;
      if (v.cm && (v.cm.w || v.cm.h || v.cm.d)) {
        const parts = [v.cm.w, v.cm.h, v.cm.d].filter(Boolean).join(" × ");
        return `${refLabel} (${parts} cm)`;
      }
      return refLabel;
    }
    case "pair": {
      if (input.kind !== "number-pair") return `${v.first} × ${v.second}`;
      return `${v.first} × ${v.second}${input.unit ? " " + input.unit : ""}`;
    }
  }
}

/** One row of the per-block summary string. */
export interface SummaryEntry {
  slotDef: SlotDefinition;
  answer: SlotAnswer | null | undefined;
}

/**
 * Build a readable multi-line summary string for a Project Spec
 * block. Pushed via onChange into student_progress.responses so
 * the marking flow's tile-progress check (which requires a
 * non-empty string at responses[tileId]) treats the block as a
 * submission.
 *
 * Header is fully formed by the caller (e.g. "Product Brief — 🧸
 * Toy / Game Design" or "User Profile"). Entries are an ordered
 * array of (slotDef, answer) pairs — slot count varies per block
 * (5 for Success Criteria, 7 for v1, 8 for User Profile, 9 for
 * Product Brief).
 */
export function buildSummary(
  header: string,
  entries: SummaryEntry[],
  completedAt?: string | null,
): string {
  const lines: string[] = [header];
  entries.forEach((e, i) => {
    lines.push("");
    lines.push(`Q${i + 1} — ${e.slotDef.title}`);
    if (!e.answer || e.answer.skipped) {
      lines.push("(skipped or not yet defined)");
    } else {
      lines.push(formatAnswer(e.answer, e.slotDef.input));
    }
  });
  if (completedAt) {
    lines.push("");
    lines.push(`(completed ${completedAt})`);
  }
  return lines.join("\n");
}
