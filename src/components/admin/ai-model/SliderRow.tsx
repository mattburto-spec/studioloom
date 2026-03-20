"use client";

import type { SliderMeta } from "@/types/ai-model-config";

export function SliderRow({
  meta,
  value,
  onChange,
}: {
  meta: SliderMeta;
  value: number;
  onChange: (v: number) => void;
}) {
  const isDefault = value === meta.defaultValue;
  const pct = ((value - meta.min) / (meta.max - meta.min)) * 100;

  return (
    <div className="group flex items-center gap-4 py-3 px-3 rounded-xl hover:bg-white/60 transition-colors">
      <div className="w-48 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{meta.label}</span>
          {meta.effectSize && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
              {meta.effectSize}
            </span>
          )}
        </div>
        {meta.description && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{meta.description}</p>
        )}
      </div>

      <div className="flex-1 relative">
        <input
          type="range"
          min={meta.min}
          max={meta.max}
          step={meta.step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-purple-600"
          style={{
            background: `linear-gradient(to right, #7C3AED ${pct}%, #E5E7EB ${pct}%)`,
          }}
        />
        {/* Default indicator */}
        {!isDefault && (
          <div
            className="absolute top-0 w-0.5 h-1.5 bg-gray-400 rounded pointer-events-none"
            style={{ left: `${((meta.defaultValue - meta.min) / (meta.max - meta.min)) * 100}%` }}
            title={`Default: ${meta.defaultValue}`}
          />
        )}
      </div>

      <div className="w-16 text-right">
        <span className={`text-sm font-mono font-semibold ${isDefault ? "text-gray-600" : "text-purple-700"}`}>
          {meta.step < 1 ? value.toFixed(2) : value}
        </span>
      </div>

      {!isDefault && (
        <button
          onClick={() => onChange(meta.defaultValue)}
          className="text-[10px] text-gray-400 hover:text-purple-600 transition-colors px-1"
          title="Reset to default"
        >
          reset
        </button>
      )}
    </div>
  );
}
