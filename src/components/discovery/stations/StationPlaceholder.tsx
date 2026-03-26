"use client";

/**
 * StationPlaceholder — empty shell for stations not yet built.
 *
 * Displays station name, emoji, and description.
 * Replaced with real components as stations are implemented.
 */

interface StationPlaceholderProps {
  station: number;
  name: string;
  description: string;
  emoji: string;
}

export function StationPlaceholder({
  station,
  name,
  description,
  emoji,
}: StationPlaceholderProps) {
  return (
    <div className="text-center">
      <div className="text-6xl mb-4">{emoji}</div>
      <h2 className="text-xl font-bold text-white mb-2">
        Station {station}: {name}
      </h2>
      <p className="text-white/50 text-sm mb-6">{description}</p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/30 text-xs">
        <span className="w-2 h-2 rounded-full bg-amber-400/50 animate-pulse" />
        Coming soon — use Continue to skip
      </div>
    </div>
  );
}
