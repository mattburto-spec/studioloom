"use client";

import type { WizardPhase } from "@/hooks/useWizardState";

interface Props {
  phase: WizardPhase;
  canBuild: boolean;
  saving: boolean;
  onBuild: () => void;
  onSave: () => void;
  onRegenerate: () => void;
}

export function StickyBuildBar({ phase, canBuild, saving, onBuild, onSave, onRegenerate }: Props) {
  // Only show in approaches and review phases
  if (phase !== "approaches" && phase !== "review") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-border shadow-lg animate-slide-up">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {phase === "approaches" && (
          <>
            <p className="text-xs text-text-secondary hidden sm:block">
              Select an approach, then build your unit
            </p>
            <button
              onClick={onBuild}
              disabled={!canBuild}
              className="px-8 py-3 bg-brand-purple text-white rounded-xl text-sm font-bold hover:bg-brand-violet transition shadow-lg shadow-brand-purple/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Build Unit
            </button>
          </>
        )}

        {phase === "review" && (
          <>
            <button
              onClick={onRegenerate}
              className="px-4 py-2.5 border border-border rounded-xl text-xs font-medium text-text-secondary hover:bg-gray-50 transition"
            >
              Regenerate
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-8 py-3 bg-accent-green text-white rounded-xl text-sm font-bold hover:bg-accent-green/90 transition shadow-lg shadow-accent-green/20 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Unit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
