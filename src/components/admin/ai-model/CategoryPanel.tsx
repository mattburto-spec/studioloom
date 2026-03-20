"use client";

import type { CategoryMeta } from "@/types/ai-model-config";
import { SliderRow } from "./SliderRow";

export function CategoryPanel({
  meta,
  values,
  onSliderChange,
  onReset,
}: {
  meta: CategoryMeta;
  values: Record<string, number>;
  onSliderChange: (key: string, value: number) => void;
  onReset: () => void;
}) {
  const changedCount = meta.sliders.filter(
    (s) => values[s.key] !== s.defaultValue
  ).length;

  // Validate relative emphasis
  const isRelativeEmphasis = meta.key === "relativeEmphasis";
  const sum = isRelativeEmphasis
    ? Object.values(values).reduce((a, b) => a + b, 0)
    : 0;
  const sumValid = !isRelativeEmphasis || Math.abs(sum - 100) <= 0.5;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{meta.label}</h2>
          <p className="text-sm text-gray-500">{meta.description}</p>
        </div>
        {changedCount > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded-md px-3 py-1.5 hover:bg-purple-50 transition-colors"
          >
            Reset ({changedCount} changed)
          </button>
        )}
      </div>

      {isRelativeEmphasis && (
        <div className={`text-xs font-mono mb-3 px-3 py-2 rounded ${sumValid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          Total: {sum}% {sumValid ? "OK" : "(must equal 100%)"}
        </div>
      )}

      <div className="space-y-0.5">
        {meta.sliders.map((slider) => (
          <SliderRow
            key={slider.key}
            meta={slider}
            value={values[slider.key] ?? slider.defaultValue}
            onChange={(v) => onSliderChange(slider.key, v)}
          />
        ))}
      </div>
    </div>
  );
}
