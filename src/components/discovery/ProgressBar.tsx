"use client";

/**
 * ProgressBar — minimal top-of-screen progress indicator.
 *
 * Shows:
 * - Overall journey progress (thin bar)
 * - Current station name + emoji
 * - Save status indicator
 */

interface ProgressBarProps {
  totalProgress: number;
  stationProgress: number;
  stationName: string;
  stationEmoji: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
}

export function ProgressBar({
  totalProgress,
  stationProgress,
  stationName,
  stationEmoji,
  saveStatus,
}: ProgressBarProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-40">
      {/* Overall progress bar — full width, very thin */}
      <div className="h-1 bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {/* Station indicator */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{stationEmoji}</span>
          <span className="text-xs font-medium text-white/50">
            {stationName}
          </span>
        </div>

        {/* Station sub-progress dots */}
        <div className="flex items-center gap-1">
          <div className="text-[10px] text-white/30 tabular-nums">
            {totalProgress}%
          </div>
        </div>
      </div>
    </div>
  );
}
