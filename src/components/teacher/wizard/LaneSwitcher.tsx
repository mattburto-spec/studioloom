"use client";

import type { WizardMode } from "@/hooks/useWizardState";

interface Props {
  currentMode: WizardMode;
  onSwitch: (mode: WizardMode) => void;
}

const LANES: Array<{
  mode: WizardMode;
  icon: string;
  label: string;
  shortLabel: string;
}> = [
  { mode: "build-for-me", icon: "⚡", label: "Express", shortLabel: "Express" },
  { mode: "guide-me", icon: "💬", label: "Guided", shortLabel: "Guided" },
  { mode: "architect", icon: "🔧", label: "Architect", shortLabel: "Architect" },
];

/**
 * Compact lane switcher shown at the top of Guided and Architect phases.
 * Lets teachers switch between wizard lanes mid-flow with answer carryover
 * (state.input is shared across all lanes, so data persists on switch).
 */
export function LaneSwitcher({ currentMode, onSwitch }: Props) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      <span className="text-[10px] text-text-tertiary mr-1.5 hidden sm:inline">Mode:</span>
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        {LANES.map(({ mode, icon, label }) => {
          const isActive = mode === currentMode;
          return (
            <button
              key={mode}
              onClick={() => {
                if (!isActive) onSwitch(mode);
              }}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
                ${isActive
                  ? "bg-white text-brand-purple shadow-sm"
                  : "text-text-tertiary hover:text-text-secondary"
                }
              `}
            >
              <span className="text-sm">{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
