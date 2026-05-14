"use client";

/**
 * Class DJ — suggestion view (Phase 5).
 *
 * Renders the 3 cards landed from the /suggest pipeline: album art (from
 * Spotify enrichment), name, kind chip, mood pills, energy meter, and a
 * conflict-mode banner with participation dot-grid.
 *
 * Brief: docs/projects/class-dj-block-brief.md §7 (suggestion view —
 * CLOSED state) + §3.5 Stage 4 (display-order is already
 * deterministically shuffled by the server's prng_seed; the
 * frontend just renders in order).
 *
 * Spotify deep-link button intentionally REMOVED (14 May 2026) — schools
 * don't want students leaving the lesson player. The spotify_url field is
 * still persisted server-side (round ledger + pick endpoint) for teacher
 * use, but never rendered as a CTA. If/when teachers need a preview
 * link in the cockpit, surface it there — not here.
 *
 * Anti-strategic-voting (brief §11 Q9): per-card mood_tags + energy_estimate
 * are the ALGORITHM'S classification of the suggestion, NOT the room's vote
 * distribution. Participation dot grid shows count-only (filled/unfilled
 * dots), never which way people voted.
 *
 * Teacher "Pick this one →" controls land in Phase 6 alongside the
 * Teaching Mode cockpit. For Phase 5 this view is read-only.
 */

import type { ConflictMode } from "@/lib/class-dj/types";

export interface SuggestionItem {
  name: string;
  kind: string;
  why: string;
  image_url: string | null;
  spotify_url: string | null;
  explicit: boolean;
  mood_tags: string[];
  energy_estimate: number;
  content_tags: string[];
  seed_origin: string | null;
  is_bridge: boolean;
}

interface Props {
  items: SuggestionItem[];
  conflictMode: ConflictMode;
  voteCount: number;
  classSize: number;
  /** Show a "Try another 3" button — wired to onTryAgain. */
  canRetry: boolean;
  onTryAgain?: () => void;
  isRetrying?: boolean;
  /** When set, render the Stage-5-failed regenerate button (Phase 6 wires the route). */
  whyLinesFromFallback?: boolean;
}

function bannerForMode(mode: ConflictMode): { text: string; emoji: string } {
  switch (mode) {
    case "split":
      return { text: "Room was split — bridge pick in the middle", emoji: "↔️" };
    case "small_group":
      return { text: "Small class — every voice mattered", emoji: "🤝" };
    case "consensus":
    default:
      return { text: "Room consensus", emoji: "🎯" };
  }
}

export default function ClassDjSuggestionView({
  items,
  conflictMode,
  voteCount,
  classSize,
  canRetry,
  onTryAgain,
  isRetrying,
}: Props) {
  const banner = bannerForMode(conflictMode);

  return (
    <div className="my-3 rounded-xl border border-violet-200 bg-white p-5 space-y-4 shadow-sm">
      {/* Header + conflict-mode banner with participation dot-grid */}
      <div>
        <h3 className="text-base font-bold text-violet-900 flex items-center gap-2 mb-2">
          <span>🎵</span> Class DJ — 3 for the room
        </h3>
        <div className="rounded-md bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-800 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span>{banner.emoji}</span>
            <span className="font-medium">{banner.text}</span>
          </div>
          <ParticipationDots voted={voteCount} total={classSize} />
        </div>
      </div>

      {/* 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((it, i) => (
          <article
            key={`${it.name}-${i}`}
            className={`rounded-lg border bg-white p-3 flex flex-col gap-2 ${
              it.is_bridge ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-200"
            }`}
          >
            {it.is_bridge && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded inline-block self-start">
                Bridge pick
              </span>
            )}
            {it.image_url ? (
              <img
                src={it.image_url}
                alt={`${it.name} cover art`}
                className="w-full aspect-square object-cover rounded-md bg-gray-100"
                loading="lazy"
              />
            ) : (
              <div
                className="w-full aspect-square rounded-md bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center text-3xl"
                aria-label={`${it.name} placeholder cover`}
              >
                🎵
              </div>
            )}
            <div>
              <h4 className="font-bold text-sm text-gray-900 leading-tight">{it.name}</h4>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                {it.kind}
              </span>
            </div>
            {/* Algorithm classification: mood pills + energy meter.
                These describe the SUGGESTION, not the room's votes. */}
            {it.mood_tags && it.mood_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {it.mood_tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <EnergyMeter value={it.energy_estimate} />
            <p className="text-xs text-gray-700 leading-snug flex-1">{it.why}</p>
          </article>
        ))}
      </div>

      {/* Retry */}
      {canRetry && (
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500">Not quite right?</span>
          <button
            type="button"
            onClick={onTryAgain}
            disabled={isRetrying}
            className="px-3 py-1.5 rounded text-violet-700 border border-violet-300 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRetrying ? "Trying another 3…" : "Try another 3"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Participation dot-grid — visceral "how full is the room?" indicator.
 *
 * Renders one dot per enrolled student (capped at 50 for layout sanity).
 * Filled violet = voted; light violet = didn't vote. Anti-strategic-voting
 * safe: shows count only, never which way each dot voted.
 *
 * For classes larger than 50 we degrade to a numeric badge ("32/64 voted")
 * — packing 64+ dots into the chip becomes noise.
 */
function ParticipationDots({ voted, total }: { voted: number; total: number }) {
  const safeTotal = Math.max(0, total);
  const safeVoted = Math.max(0, Math.min(voted, safeTotal));

  if (safeTotal > 50) {
    return (
      <div className="text-[11px] text-violet-700 font-medium">
        {safeVoted} of {safeTotal} voted
      </div>
    );
  }

  // Smaller dots when the row gets crowded.
  const dotSize = safeTotal > 30 ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="img"
      aria-label={`${safeVoted} of ${safeTotal} students voted`}
    >
      {Array.from({ length: safeTotal }, (_, i) => (
        <span
          key={i}
          className={`${dotSize} rounded-full ${
            i < safeVoted ? "bg-violet-600" : "bg-violet-200"
          }`}
          aria-hidden
        />
      ))}
      <span className="text-[10.5px] text-violet-600 ml-1 tabular-nums">
        {safeVoted}/{safeTotal}
      </span>
    </div>
  );
}

/**
 * 5-segment energy meter for the suggested track.
 *
 * value is the algorithm's energy_estimate (0..1 expected — clamped
 * defensively). Filled cells = roughly how energetic this pick is, lo→hi.
 * Qualitative not numeric — students don't need the raw float.
 */
function EnergyMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const filled = Math.max(1, Math.round(v * 5)); // at least 1 cell so empty doesn't look broken
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9.5px] uppercase tracking-wider text-gray-500 font-medium">
        Energy
      </span>
      <div className="flex gap-0.5" aria-label={`Energy level ${filled} of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-sm ${
              i < filled ? "bg-violet-500" : "bg-gray-200"
            }`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
