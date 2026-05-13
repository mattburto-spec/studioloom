"use client";

/**
 * Class DJ — vote form (student-side, mobile-first).
 *
 * Renders mood chips + energy slider + optional veto + optional seed.
 * On submit, POSTs to /api/student/class-dj/vote and bubbles the
 * server's vote_count up via onVoted so the parent can show "voted!"
 * state without an extra round-trip.
 *
 * The form is editable until the round closes (UPSERT on server side).
 */

import { useState } from "react";
import type { Mood } from "@/lib/class-dj/types";

const MOODS: { value: Mood; label: string; tooltip: string; emoji: string }[] = [
  { value: "focus", label: "Focus", tooltip: "Heads down, concentrating", emoji: "🎯" },
  { value: "build", label: "Build", tooltip: "Making / prototyping", emoji: "🔨" },
  { value: "vibe", label: "Vibe", tooltip: "Chill social work", emoji: "✨" },
  { value: "crit", label: "Crit", tooltip: "Discussion / review", emoji: "💬" },
  { value: "fun", label: "Fun", tooltip: "End of period / cleanup", emoji: "🎉" },
];

interface Props {
  roundId: string;
  initialMood?: Mood;
  initialEnergy?: number;
  initialVeto?: string | null;
  initialSeed?: string | null;
  onVoted?: (info: { voteCount: number }) => void;
}

export default function ClassDjVoteForm({
  roundId,
  initialMood,
  initialEnergy,
  initialVeto,
  initialSeed,
  onVoted,
}: Props) {
  const [mood, setMood] = useState<Mood | null>(initialMood ?? null);
  const [energy, setEnergy] = useState<number>(initialEnergy ?? 3);
  const [veto, setVeto] = useState<string>(initialVeto ?? "");
  const [seed, setSeed] = useState<string>(initialSeed ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!mood) {
      setError("Pick a mood first");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/class-dj/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          roundId,
          mood,
          energy,
          veto: veto.trim() || null,
          seed: seed.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { vote_count?: number; error?: string };
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setSubmitted(true);
      onVoted?.({ voteCount: body.vote_count ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mood chips */}
      <fieldset>
        <legend className="text-xs font-semibold text-gray-700 mb-2">Mood</legend>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              type="button"
              key={m.value}
              onClick={() => setMood(m.value)}
              title={m.tooltip}
              aria-pressed={mood === m.value}
              className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
                mood === m.value
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-violet-300"
              }`}
            >
              <span className="mr-1">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Energy slider */}
      <fieldset>
        <div className="flex items-baseline justify-between mb-1">
          <legend className="text-xs font-semibold text-gray-700">Energy</legend>
          <span className="text-xs tabular-nums text-gray-500">{energy} / 5</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={energy}
          onChange={(e) => setEnergy(Number.parseInt(e.target.value, 10))}
          aria-label="Energy level 1 to 5"
          className="w-full accent-violet-600"
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
          <span>chill backdrop</span>
          <span>pump it up</span>
        </div>
      </fieldset>

      {/* Veto — optional */}
      <div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700 mb-1 block">
            ❌ NOT today (optional)
          </span>
          <input
            type="text"
            value={veto}
            onChange={(e) => setVeto(e.target.value.slice(0, 80))}
            maxLength={80}
            placeholder="no country pls"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
        </label>
      </div>

      {/* Seed — optional */}
      <div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700 mb-1 block">
            🎵 In the hat (optional)
          </span>
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value.slice(0, 80))}
            maxLength={80}
            placeholder="artist, song or vibe"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !mood}
        className="w-full px-4 py-3 rounded-md bg-violet-600 text-white font-semibold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-violet-700 transition-colors"
      >
        {submitting ? "Submitting…" : submitted ? "Update vote" : "Drop my vote"}
      </button>
    </form>
  );
}
