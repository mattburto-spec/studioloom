"use client";

import type { LockableField } from "@/types/unit-brief";

interface LockToggleProps {
  field: LockableField;
  locked: boolean;
  onToggle: (field: LockableField, next: boolean) => void;
  disabled?: boolean;
}

/**
 * Per-field lock toggle (Phase F.B + post-F.E polish).
 *
 * Visual (always rectangular pill — Matt's polish feedback was the
 * compact icon-only variant was too subtle):
 *   - Locked:   🔒 Locked   (purple filled — high-contrast)
 *   - Unlocked: 🔓 Open      (gray outline — invites click)
 *
 * Click flips and calls `onToggle(field, next)` — caller persists.
 * Same data shape across unit_briefs and choice_cards.
 */
export function LockToggle({
  field,
  locked,
  onToggle,
  disabled,
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
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide transition disabled:opacity-50 ${
        locked
          ? "bg-purple-600 text-white ring-1 ring-inset ring-purple-700 hover:bg-purple-700"
          : "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:ring-gray-400"
      }`}
    >
      <span aria-hidden="true" className="text-sm">{locked ? "🔒" : "🔓"}</span>
      <span>{label}</span>
    </button>
  );
}
