"use client";

// Phase 4 stub. Phase 5 lands the full hero + Where-you-left-off +
// this_class card list + commitment field + Start flow.

import type { FirstMoveConfig } from "@/components/teacher/lesson-editor/BlockPalette.types";

interface Props {
  activityId: string;
  config: FirstMoveConfig;
  unitId: string;
  value: string;
  onChange: (value: string) => void;
}

export default function FirstMoveBlock({ config }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
      <div className="text-3xl mb-2">⚡</div>
      <div className="text-sm font-semibold text-amber-900">First Move</div>
      <div className="mt-1 text-xs text-amber-700">
        Studio-open orientation —{" "}
        {config.requireCardChoice ? "pick one This Class card" : "free-form"} +
        write a {config.minCommitmentWords}-word commitment. Full component
        lands in Phase 5.
      </div>
    </div>
  );
}
