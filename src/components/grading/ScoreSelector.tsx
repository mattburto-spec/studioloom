"use client";

import type { GradingScale } from "@/lib/constants";

/**
 * Framework-aware score input control. Pairs with ScorePill (display).
 *
 * Discrete scales (MYP 1–8, PLTW 1–4, ACARA A–E) render as a button grid.
 * Percentage scales (GCSE / IGCSE / A-Level / Victorian) render as a
 * number input with `%` suffix.
 *
 * Polish-3 — every variant carries an "NA" toggle button (rightmost on
 * the discrete grid; inline next to the percentage input). NA is mutually
 * exclusive with a numeric score: clicking NA clears the score; clicking
 * a number clears NA. Up to the row to interpret (NA + confirmed = saved
 * non-numeric grade).
 *
 * The selector is presentational — wiring (save round-trip, optimistic
 * update) lives in the parent CalibrateRow.
 */

export interface ScoreSelectorProps {
  scale: GradingScale;
  value: number | null;
  /** Polish-3 — NA flag (true means "intentionally not graded numerically"). */
  isNa?: boolean;
  /** Score change. Signature kept identical to G1 for backwards compat —
   *  callers that don't yet know about NA can ignore the second arg. */
  onChange: (next: number | null, opts?: { na?: boolean }) => void;
  disabled?: boolean;
}

export function ScoreSelector({
  scale,
  value,
  isNa = false,
  onChange,
  disabled,
}: ScoreSelectorProps) {
  const naButton = (
    <button
      key="na"
      type="button"
      onClick={() => onChange(null, { na: !isNa })}
      disabled={disabled}
      className={[
        "min-w-[36px] h-7 px-2 rounded-md text-[11px] font-bold border transition uppercase tracking-wide",
        isNa
          ? "bg-gray-700 text-white border-gray-700"
          : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
      aria-pressed={isNa}
      title={isNa ? "Clear NA" : "Mark this tile as Not Applicable for this student"}
    >
      N/A
    </button>
  );

  if (scale.type === "percentage") {
    return (
      <div className="inline-flex items-center gap-1.5">
        <input
          type="number"
          min={scale.min}
          max={scale.max}
          step={scale.step}
          value={isNa ? "" : (value ?? "")}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null, { na: false });
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n)) {
              onChange(Math.max(scale.min, Math.min(scale.max, n)), { na: false });
            }
          }}
          disabled={disabled || isNa}
          className={[
            "w-16 px-2 py-1 text-sm font-bold border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 tabular-nums",
            isNa ? "border-gray-300 bg-gray-100 text-gray-400" : "border-gray-200",
          ].join(" ")}
        />
        <span className="text-xs font-semibold text-gray-500">%</span>
        {naButton}
      </div>
    );
  }

  // Discrete (numeric / letter) — button grid + trailing NA
  const options: number[] = [];
  for (let v = scale.min; v <= scale.max; v += scale.step) options.push(v);

  return (
    <div className="inline-flex flex-wrap gap-1">
      {options.map((opt) => {
        const selected = !isNa && value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(selected ? null : opt, { na: false })}
            disabled={disabled}
            className={[
              "min-w-[28px] h-7 px-2 rounded-md text-xs font-bold border transition tabular-nums",
              selected
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50",
              isNa ? "opacity-40" : "",
              disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
            aria-pressed={selected}
            data-value={opt}
          >
            {scale.formatDisplay(opt)}
          </button>
        );
      })}
      {naButton}
    </div>
  );
}
