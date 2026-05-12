"use client";

// Inspiration Board — inline config panel in the lesson editor.
// Mounted in ActivityBlock.tsx when the section's responseType is
// "inspiration-board".
//
// Surfaces the InspirationBoardConfig knobs + the reusable
// ArchetypeOverridesEditor (also used by future archetype-aware
// blocks).

import type { ActivitySection } from "@/types";
import type { InspirationBoardConfig } from "./BlockPalette.types";
import ArchetypeOverridesEditor, {
  type ArchetypeOverridesMap,
} from "./ArchetypeOverridesEditor";

const DEFAULT_CONFIG: InspirationBoardConfig = {
  minItems: 3,
  maxItems: 5,
  requireCommentary: true,
  showSynthesisPrompt: true,
  showStealPrompt: false,
  allowUrlPaste: true,
};

interface Props {
  activity: ActivitySection;
  onUpdate: (patch: Partial<ActivitySection>) => void;
}

export default function InspirationBoardConfigPanel({ activity, onUpdate }: Props) {
  const cfg = activity.inspirationBoardConfig ?? DEFAULT_CONFIG;

  function patchConfig(next: Partial<InspirationBoardConfig>) {
    onUpdate({
      inspirationBoardConfig: { ...cfg, ...next },
    });
  }

  function patchOverrides(next: ArchetypeOverridesMap) {
    onUpdate({ archetype_overrides: next });
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-pink-200 bg-pink-50/60 p-3">
      <div className="flex items-center gap-1.5">
        <span>🖼️</span>
        <label className="text-[12px] font-bold text-pink-900">
          Inspiration Board config
        </label>
      </div>

      {/* Min / max items */}
      <div className="flex flex-wrap gap-3">
        <NumField
          label="Min items"
          value={cfg.minItems}
          min={1}
          max={10}
          onChange={(v) =>
            patchConfig({ minItems: Math.min(v, cfg.maxItems) })
          }
        />
        <NumField
          label="Max items"
          value={cfg.maxItems}
          min={Math.max(cfg.minItems, 2)}
          max={15}
          onChange={(v) =>
            patchConfig({ maxItems: Math.max(v, cfg.minItems) })
          }
        />
      </div>

      {/* Toggles */}
      <div className="space-y-1">
        <Toggle
          label="Require commentary on each image"
          checked={cfg.requireCommentary}
          onChange={(v) => patchConfig({ requireCommentary: v })}
        />
        <Toggle
          label='Show "what they share" synthesis prompt'
          checked={cfg.showSynthesisPrompt}
          onChange={(v) => patchConfig({ showSynthesisPrompt: v })}
        />
        <Toggle
          label='Show optional "what would you steal?" field'
          checked={cfg.showStealPrompt}
          onChange={(v) => patchConfig({ showStealPrompt: v })}
        />
        <Toggle
          label="Allow paste URL (alongside file upload)"
          checked={cfg.allowUrlPaste}
          onChange={(v) => patchConfig({ allowUrlPaste: v })}
        />
      </div>

      {/* Archetype overrides */}
      <ArchetypeOverridesEditor
        overrides={activity.archetype_overrides}
        onChange={patchOverrides}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-pink-900">
      <span className="font-semibold">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="w-16 rounded border border-pink-200 bg-white px-1.5 py-0.5 text-center text-[12px]"
      />
    </label>
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
    <label className="flex items-center gap-2 text-[12px] text-pink-900 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-pink-300 text-pink-600 focus:ring-pink-500"
      />
      <span>{label}</span>
    </label>
  );
}
