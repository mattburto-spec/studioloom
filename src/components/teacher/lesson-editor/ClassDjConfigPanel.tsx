"use client";

// Class DJ — inline config panel in the lesson editor.
// Mounted in ActivityBlock.tsx when responseType is "class-dj".
//
// Brief: docs/projects/class-dj-block-brief.md §7 (UI surface — lesson editor config panel)
// Phase: 3 (13 May 2026)
//
// The algorithm constants (σ, MMR λ, EMA α, etc.) are LOCKED in
// src/lib/class-dj/types.ts → ALGO_CONSTANTS and are NOT teacher-tunable.
// This panel only exposes the three per-round parameters the brief
// designates as teacher-editable.

import type { ActivitySection } from "@/types";
import type { ClassDjConfig } from "./BlockPalette.types";

const DEFAULT_CONFIG: ClassDjConfig = {
  timerSeconds: 60,
  gateMinVotes: 3,
  maxSuggestions: 3,
};

const TIMER_MIN = 30;
const TIMER_MAX = 180;
const GATE_MIN = 2;
const GATE_MAX = 10;
const SUGGEST_MIN = 1;
const SUGGEST_MAX = 3;

interface Props {
  activity: ActivitySection;
  onUpdate: (patch: Partial<ActivitySection>) => void;
}

export default function ClassDjConfigPanel({ activity, onUpdate }: Props) {
  const cfg = activity.classDjConfig ?? DEFAULT_CONFIG;

  function patch(next: Partial<ClassDjConfig>) {
    onUpdate({ classDjConfig: { ...cfg, ...next } });
  }

  function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <div className="flex items-center gap-1.5">
        <span>🎵</span>
        <label className="text-[12px] font-bold text-violet-900">
          Class DJ config
        </label>
      </div>

      {/* Timer duration — slider */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <label className="text-[12px] font-semibold text-violet-900">
            Round timer
          </label>
          <span className="text-[12px] text-violet-700 tabular-nums">
            {cfg.timerSeconds}s
          </span>
        </div>
        <input
          type="range"
          min={TIMER_MIN}
          max={TIMER_MAX}
          step={5}
          value={cfg.timerSeconds}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) patch({ timerSeconds: clamp(n, TIMER_MIN, TIMER_MAX) });
          }}
          aria-label="Round timer duration in seconds"
          className="w-full accent-violet-600"
        />
        <div className="flex justify-between text-[10px] text-violet-600">
          <span>30s (quick vibe-check)</span>
          <span>180s (longer deliberation)</span>
        </div>
      </div>

      {/* Min votes to unlock Suggest */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-violet-900">
          <span className="font-semibold">Min votes to unlock “Suggest”</span>
          <input
            type="number"
            value={cfg.gateMinVotes}
            min={GATE_MIN}
            max={GATE_MAX}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) patch({ gateMinVotes: clamp(n, GATE_MIN, GATE_MAX) });
            }}
            aria-label="Minimum vote count before Suggest button unlocks"
            className="w-16 rounded border border-violet-200 bg-white px-1.5 py-0.5 text-center text-[12px]"
          />
        </label>
        <span className="text-[10.5px] text-violet-600">
          range {GATE_MIN}–{GATE_MAX}; default 3
        </span>
      </div>

      {/* Max suggestions per round */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-violet-900">
          <span className="font-semibold">Max suggestions per round</span>
          <input
            type="number"
            value={cfg.maxSuggestions}
            min={SUGGEST_MIN}
            max={SUGGEST_MAX}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) patch({ maxSuggestions: clamp(n, SUGGEST_MIN, SUGGEST_MAX) });
            }}
            aria-label="Maximum AI synthesis attempts per round"
            className="w-16 rounded border border-violet-200 bg-white px-1.5 py-0.5 text-center text-[12px]"
          />
        </label>
        <span className="text-[10.5px] text-violet-600">
          {SUGGEST_MIN}–{SUGGEST_MAX} attempts (Try another 3 reroll cap)
        </span>
      </div>

      <p className="text-[10.5px] leading-snug text-violet-700">
        Class DJ runs a deterministic 5-stage pipeline — mood approval +
        gaussian energy fit + k-means split detection + Pareto+MMR
        selection — bracketed by Stage 3 LLM candidate-pool + Stage 5
        narration. Locked algorithm constants live in
        docs/specs/class-dj-algorithm.md (not teacher-tunable).
      </p>
    </div>
  );
}

/** Exported for tests + Phase 4 API. */
export { DEFAULT_CONFIG as CLASS_DJ_DEFAULT_CONFIG };
