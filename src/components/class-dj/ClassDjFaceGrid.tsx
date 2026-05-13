"use client";

/**
 * Class DJ — face-grid (shared participation visualizer).
 *
 * Renders class_size dots; first `participation_count` of them are
 * "lit" (filled). Used by both student and teacher views.
 *
 * Critically: this view shows WHO has voted by count, NOT WHAT they
 * voted (no mood/energy distribution leaks to students — anti-strategic-
 * voting per brief §11 Q9 hybrid decision). The teacher cockpit ALSO
 * renders the full mood/energy histograms alongside this grid; students
 * see this and nothing more.
 */

interface Props {
  participationCount: number;
  classSize: number;
  /** True for teacher cockpit — use a denser visual since the teacher sees full tally elsewhere. */
  compact?: boolean;
}

export default function ClassDjFaceGrid({ participationCount, classSize, compact = false }: Props) {
  const total = Math.max(classSize, 1);
  const voted = Math.min(Math.max(participationCount, 0), total);
  const dotSize = compact ? "h-2 w-2" : "h-3 w-3";

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex flex-wrap gap-1.5"
        role="img"
        aria-label={`${voted} of ${total} students have voted`}
      >
        {Array.from({ length: total }).map((_, i) => {
          const lit = i < voted;
          return (
            <span
              key={i}
              className={`${dotSize} rounded-full inline-block transition-colors ${
                lit ? "bg-violet-500" : "bg-gray-200"
              }`}
            />
          );
        })}
      </div>
      <div className="text-[11px] tabular-nums text-gray-600">
        {voted} of {total} voted
      </div>
    </div>
  );
}
