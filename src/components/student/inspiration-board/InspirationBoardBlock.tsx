"use client";

// Phase 3a stub. Phase 3b lands the full Pinterest-style grid + image
// upload + per-card commentary + synthesis card + reduced-motion +
// keyboard nav + Mark-complete gating.

import type { ActivitySection } from "@/types";
import type { InspirationBoardConfig } from "@/components/teacher/lesson-editor/BlockPalette.types";

interface Props {
  activityId: string;
  section: ActivitySection;
  config: InspirationBoardConfig;
  unitId: string;
  value: string;
  onChange: (value: string) => void;
}

export default function InspirationBoardBlock({ config }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-pink-300 bg-pink-50 p-6 text-center">
      <div className="text-3xl mb-2">🖼️</div>
      <div className="text-sm font-semibold text-pink-900">Inspiration Board</div>
      <div className="mt-1 text-xs text-pink-700">
        {config.minItems}&ndash;{config.maxItems} images, archetype-aware framing —
        full component lands in Phase 3b.
      </div>
    </div>
  );
}
