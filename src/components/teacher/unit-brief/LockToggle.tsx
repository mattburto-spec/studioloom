"use client";

import type { LockableField } from "@/types/unit-brief";

interface LockToggleProps {
  field: LockableField;
  locked: boolean;
  onToggle: (field: LockableField, next: boolean) => void;
  disabled?: boolean;
  /**
   * Compact = icon-only (default; used inline with field labels).
   * Full = icon + "Locked" / "Open" label (used in standalone rows).
   */
  variant?: "compact" | "full";
}

/**
 * Per-field lock toggle (Phase F.B). Visual:
 *   - Locked:   🔒 purple-tinted button — teacher value shown read-only to students
 *   - Unlocked: 🔓 gray outline — student-editable; teacher value (if any) is a starter
 *
 * Click flips and calls `onToggle(field, next)` — caller persists.
 * Same data shape across unit_briefs and choice_cards (Phase F.C will
 * reuse this for the choice-card brief template editor).
 */
export function LockToggle({
  field,
  locked,
  onToggle,
  disabled,
  variant = "compact",
}: LockToggleProps) {
  const label = locked ? "Locked" : "Open";
  const ariaLabel = `${locked ? "Unlock" : "Lock"} field ${field}`;

  return (
    <button
      type="button"
      onClick={() => onToggle(field, !locked)}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={locked}
      data-testid={`lock-toggle-${field}`}
      title={
        locked
          ? "Locked — student sees your value, can't edit. Click to open."
          : "Open — student can edit (your value is a starter). Click to lock."
      }
      className={
        variant === "full"
          ? `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
              locked
                ? "bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-300 hover:bg-purple-200"
                : "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-100"
            }`
          : `inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] transition ${
              locked
                ? "bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-300 hover:bg-purple-200"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`
      }
    >
      <span aria-hidden="true">{locked ? "🔒" : "🔓"}</span>
      {variant === "full" && <span>{label}</span>}
    </button>
  );
}
