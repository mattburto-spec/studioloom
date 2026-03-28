"use client";

import { getFrameworkGradeLevels } from "@/lib/constants";
import type { WizardDispatch, WizardState } from "@/hooks/useWizardState";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
}

export function CompactConfig({ state, dispatch }: Props) {
  const { input } = state;
  const gradeLevels = getFrameworkGradeLevels(input.framework);

  return (
    <div className="animate-slide-up flex flex-wrap items-center justify-center gap-4 max-w-2xl mx-auto py-4">
      {/* Grade level pills */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Grade:</span>
        <div className="flex gap-1">
          {gradeLevels.map((g) => {
            const short = g.replace("Year ", "Y").replace(/ \(Grade \d+\)/, "");
            const isSelected = input.gradeLevel === g;
            return (
              <button
                key={g}
                onClick={() => dispatch({ type: "SET_INPUT", key: "gradeLevel", value: g })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isSelected
                    ? "bg-brand-purple text-white shadow-sm"
                    : "bg-surface-alt text-text-secondary hover:bg-gray-200"
                }`}
                title={g}
              >
                {short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Duration:</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={4}
            max={12}
            step={1}
            value={input.durationWeeks}
            onChange={(e) =>
              dispatch({ type: "SET_INPUT", key: "durationWeeks", value: parseInt(e.target.value) })
            }
            className="w-24 h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #7B2FF2 0%, #7B2FF2 ${((input.durationWeeks - 4) / 8) * 100}%, #e2e8f0 ${((input.durationWeeks - 4) / 8) * 100}%, #e2e8f0 100%)`,
            }}
            aria-label="Duration in weeks"
          />
          <span className="text-xs font-bold text-brand-purple tabular-nums">
            {input.durationWeeks}w
          </span>
        </div>
      </div>
    </div>
  );
}
