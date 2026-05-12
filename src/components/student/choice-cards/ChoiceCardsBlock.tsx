"use client";

// Phase 3a stub. Phase 3b lands the full Framer Motion deck + flip +
// pick flow + focus mode + reduced-motion fallback + pitch-your-own
// card + ships-to-platform badge.

import type { ChoiceCardsBlockConfig } from "@/components/teacher/lesson-editor/BlockPalette.types";

interface ChoiceCardsBlockProps {
  activityId: string;
  config: ChoiceCardsBlockConfig;
  unitId?: string;
  onChange: (value: string) => void;
}

export default function ChoiceCardsBlock({ config }: ChoiceCardsBlockProps) {
  return (
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-6 text-center">
      <div className="text-3xl mb-2">🃏</div>
      <div className="text-sm font-semibold text-emerald-900">Choice Cards</div>
      <div className="mt-1 text-xs text-emerald-700">
        {config.cardIds.length} card{config.cardIds.length === 1 ? "" : "s"} in deck — full component lands in Phase 3b.
      </div>
    </div>
  );
}
