"use client";

import type { ResolvedModelConfig } from "@/types/ai-model-config";
import { TIMING_CATEGORY_META, DEFAULT_MODEL_CONFIG } from "@/lib/ai/model-config-defaults";

export function TimingPanel({
  profiles,
  onTimingChange,
  onReset,
}: {
  profiles: ResolvedModelConfig["timingProfiles"];
  onTimingChange: (year: number, field: string, value: number) => void;
  onReset: () => void;
}) {
  const fields = TIMING_CATEGORY_META.fields;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{TIMING_CATEGORY_META.label}</h2>
          <p className="text-sm text-gray-500">{TIMING_CATEGORY_META.description}</p>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded-md px-3 py-1.5 hover:bg-purple-50 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-gray-500 font-medium">Field</th>
              {TIMING_CATEGORY_META.years.map((y) => (
                <th key={y} className="text-center py-2 px-3 text-gray-500 font-medium">
                  Year {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-900 text-xs">{field.label}</td>
                {TIMING_CATEGORY_META.years.map((year) => {
                  const profile = profiles[year];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const val = profile ? (profile as any)[field.key] as number : 0;
                  const defProfile = DEFAULT_MODEL_CONFIG.timingProfiles[year];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const defVal = defProfile ? (defProfile as any)[field.key] as number : 0;
                  const isChanged = val !== defVal;

                  return (
                    <td key={year} className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={val}
                        onChange={(e) => onTimingChange(year, field.key, parseInt(e.target.value) || 0)}
                        className={`w-14 text-center text-sm border rounded px-1 py-1 ${
                          isChanged
                            ? "border-purple-400 bg-purple-50 text-purple-700 font-semibold"
                            : "border-gray-200 text-gray-700"
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
