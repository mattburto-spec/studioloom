"use client";

/**
 * Class DJ — suggestion view (Phase 5).
 *
 * Renders the 3 cards landed from the /suggest pipeline: album art (from
 * Spotify enrichment), name, why-line, kind chip, conflict-mode banner,
 * and a Spotify deep-link.
 *
 * Brief: docs/projects/class-dj-block-brief.md §7 (suggestion view —
 * CLOSED state) + §3.5 Stage 4 (display-order is already
 * deterministically shuffled by the server's prng_seed; the
 * frontend just renders in order).
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
      {/* Header + conflict-mode banner */}
      <div>
        <h3 className="text-base font-bold text-violet-900 flex items-center gap-2 mb-1">
          <span>🎵</span> Class DJ — 3 for the room
        </h3>
        <div className="rounded-md bg-violet-50 border border-violet-100 px-3 py-1.5 text-xs text-violet-800 inline-flex items-center gap-1.5">
          <span>{banner.emoji}</span>
          <span>{banner.text}</span>
          <span className="text-violet-400 ml-1">·</span>
          <span className="text-violet-500">
            {voteCount} of {classSize} voted
          </span>
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
            <p className="text-xs text-gray-700 leading-snug flex-1">{it.why}</p>
            {it.spotify_url ? (
              <a
                href={it.spotify_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                <span>Open on Spotify</span>
                <span aria-hidden>↗</span>
              </a>
            ) : (
              <span className="mt-1 inline-block px-3 py-1.5 text-xs text-gray-400 italic">
                (no Spotify link)
              </span>
            )}
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
