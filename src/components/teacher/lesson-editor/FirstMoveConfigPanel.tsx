"use client";

// First Move — inline config panel in the lesson editor.
// Mounted in ActivityBlock.tsx when responseType is "first-move".

import type { ActivitySection } from "@/types";
import type { FirstMoveConfig } from "./BlockPalette.types";

const DEFAULT_CONFIG: FirstMoveConfig = {
  minCommitmentWords: 5,
  requireCardChoice: true,
  showDesignPhilosophy: true,
  showWhereLeftOff: true,
};

interface Props {
  activity: ActivitySection;
  onUpdate: (patch: Partial<ActivitySection>) => void;
}

export default function FirstMoveConfigPanel({ activity, onUpdate }: Props) {
  const cfg = activity.firstMoveConfig ?? DEFAULT_CONFIG;

  function patch(next: Partial<FirstMoveConfig>) {
    onUpdate({ firstMoveConfig: { ...cfg, ...next } });
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-center gap-1.5">
        <span>⚡</span>
        <label className="text-[12px] font-bold text-amber-900">
          First Move config
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-amber-900">
          <span className="font-semibold">Min commitment words</span>
          <input
            type="number"
            value={cfg.minCommitmentWords}
            min={1}
            max={30}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n))
                patch({ minCommitmentWords: Math.max(1, Math.min(30, n)) });
            }}
            className="w-16 rounded border border-amber-200 bg-white px-1.5 py-0.5 text-center text-[12px]"
          />
        </label>
      </div>

      <div className="space-y-1">
        <Toggle
          label="Require a card choice before Start enables"
          checked={cfg.requireCardChoice}
          onChange={(v) => patch({ requireCardChoice: v })}
        />
        <Toggle
          label="Show design philosophy hero (from Class 1 Strategy Canvas)"
          checked={cfg.showDesignPhilosophy}
          onChange={(v) => patch({ showDesignPhilosophy: v })}
        />
        <Toggle
          label='Show "Where you left off" panel (last journal NEXT + last done card)'
          checked={cfg.showWhereLeftOff}
          onChange={(v) => patch({ showWhereLeftOff: v })}
        />
      </div>

      <p className="text-[10.5px] leading-snug text-amber-700">
        First Move pulls live data: design philosophy from any Strategy
        Canvas response in this unit, last NEXT from the most recent
        Process Journal entry, and the student&apos;s current
        &ldquo;This Class&rdquo; kanban lane. Reusable — drop one at the
        top of every studio lesson.
      </p>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-[12px] text-amber-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
      />
      <span>{label}</span>
    </label>
  );
}
