"use client";

/**
 * Class DJ — LIVE state view for TEACHER sessions.
 *
 * Renders full live tally — mood histogram + energy histogram + voter
 * face-grid + countdown. This is the teacher cockpit view; full
 * distribution is intentional (the teacher needs it to read the room).
 *
 * Brief §7 (teacher cockpit live view): countdown + full mood histogram
 * + full energy histogram + voter face-grid; polling at 1s.
 *
 * NOTE: Phase 4 ships the view but NOT the teacher controls
 * (Start / Suggest now / End / Pick / Run again — those land in Phase 6
 * alongside the Teaching Mode cockpit dispatch refactor).
 */

import { useEffect, useState } from "react";
import ClassDjFaceGrid from "./ClassDjFaceGrid";
import type { Mood } from "@/lib/class-dj/types";

const MOOD_LABELS: Record<Mood, { label: string; emoji: string }> = {
  focus: { label: "Focus", emoji: "🎯" },
  build: { label: "Build", emoji: "🔨" },
  vibe: { label: "Vibe", emoji: "✨" },
  crit: { label: "Crit", emoji: "💬" },
  fun: { label: "Fun", emoji: "🎉" },
};

interface RoundLike {
  id: string;
  ends_at: string;
  class_round_index: number;
}

interface Tally {
  mood_histogram: Record<string, number>;
  energy_histogram: Record<string, number>;
}

interface Props {
  round: RoundLike;
  tally: Tally;
  participationCount: number;
  classSize: number;
}

export default function ClassDjLiveTeacherView({
  round,
  tally,
  participationCount,
  classSize,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((new Date(round.ends_at).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(
        Math.max(0, Math.ceil((new Date(round.ends_at).getTime() - Date.now()) / 1000)),
      );
    }, 250);
    return () => clearInterval(interval);
  }, [round.ends_at]);

  const moodMax = Math.max(1, ...Object.values(tally.mood_histogram));
  const energyMax = Math.max(1, ...Object.values(tally.energy_histogram));

  return (
    <div className="my-3 rounded-xl border-2 border-violet-300 bg-white p-5 space-y-4 shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-violet-900 flex items-center gap-2">
          <span>🎵</span> Class DJ
          <span className="text-[10px] uppercase tracking-wider font-semibold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
            Teacher view · round {round.class_round_index}
          </span>
        </h3>
        <div
          className="text-3xl font-bold tabular-nums text-violet-700"
          role="timer"
          aria-label={`${secondsLeft} seconds remaining`}
        >
          {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
          {String(secondsLeft % 60).padStart(2, "0")}
        </div>
      </div>

      <ClassDjFaceGrid
        participationCount={participationCount}
        classSize={classSize}
        compact
      />

      {/* Mood histogram */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Mood</h4>
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(MOOD_LABELS) as Mood[]).map((m) => {
            const count = tally.mood_histogram[m] ?? 0;
            const pct = (count / moodMax) * 100;
            return (
              <div key={m} className="flex flex-col items-center gap-1">
                <div className="h-20 w-full bg-gray-100 rounded flex items-end overflow-hidden">
                  <div
                    className="w-full bg-violet-500 transition-all"
                    style={{ height: `${pct}%` }}
                    aria-label={`${count} votes for ${m}`}
                  />
                </div>
                <div className="text-[11px] font-medium text-gray-700 flex items-center gap-1">
                  <span>{MOOD_LABELS[m].emoji}</span>
                  <span>{count}</span>
                </div>
                <div className="text-[10px] text-gray-500">{MOOD_LABELS[m].label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Energy histogram */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Energy</h4>
        <div className="grid grid-cols-5 gap-2">
          {([1, 2, 3, 4, 5] as const).map((e) => {
            const count = tally.energy_histogram[String(e)] ?? 0;
            const pct = (count / energyMax) * 100;
            return (
              <div key={e} className="flex flex-col items-center gap-1">
                <div className="h-16 w-full bg-gray-100 rounded flex items-end overflow-hidden">
                  <div
                    className="w-full bg-violet-400 transition-all"
                    style={{ height: `${pct}%` }}
                    aria-label={`${count} votes at energy ${e}`}
                  />
                </div>
                <div className="text-[11px] font-medium text-gray-700 tabular-nums">
                  {count}
                </div>
                <div className="text-[10px] text-gray-500">e{e}</div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>chill</span>
          <span>pump it</span>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 italic">
        Teacher controls (Suggest now / End round / Pick) land in Phase 6
        — alongside Teaching Mode dispatch.
      </p>
    </div>
  );
}
