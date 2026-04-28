"use client";

import type { GradingScale } from "@/lib/constants";

/**
 * Framework-aware score input control. Pairs with ScorePill (display).
 *
 * Discrete scales (MYP 1–8, PLTW 1–4, ACARA A–E) render as a button grid.
 * Percentage scales (GCSE / IGCSE / A-Level / Victorian) render as a
 * number input with `%` suffix.
 *
 * The selector is presentational — wiring (save round-trip, optimistic
 * update) lives in the parent CalibrateRow.
 */

export interface ScoreSelectorProps {
  scale: GradingScale;
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}

export function ScoreSelector({ scale, value, onChange, disabled }: ScoreSelectorProps) {
  if (scale.type === "percentage") {
    return (
      <div className="inline-flex items-center gap-1.5">
        <input
          type="number"
          min={scale.min}
          max={scale.max}
          step={scale.step}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n)) {
              onChange(Math.max(scale.min, Math.min(scale.max, n)));
            }
          }}
          disabled={disabled}
          className="w-16 px-2 py-1 text-sm font-bold border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 tabular-nums"
        />
        <span className="text-xs font-semibold text-gray-500">%</span>
      </div>
    );
  }

  // Discrete (numeric / letter) — button grid
  const options: number[] = [];
  for (let v = scale.min; v <= scale.max; v += scale.step) options.push(v);

  return (
    <div className="inline-flex flex-wrap gap-1">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(selected ? null : opt)}
            disabled={disabled}
            className={[
              "min-w-[28px] h-7 px-2 rounded-md text-xs font-bold border transition tabular-nums",
              selected
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50",
              disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
            aria-pressed={selected}
            data-value={opt}
          >
            {scale.formatDisplay(opt)}
          </button>
        );
      })}
    </div>
  );
}
