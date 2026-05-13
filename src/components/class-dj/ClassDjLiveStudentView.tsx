"use client";

/**
 * Class DJ — LIVE state view for STUDENT sessions.
 *
 * Renders: countdown timer + face-grid (participation count, NOT
 * distribution) + vote form (or "voted" confirmation).
 *
 * Brief §11 Q9 hybrid: students do NOT see mood/energy distribution
 * — only how many classmates have voted. Anti-strategic-voting per
 * Zou-Meir-Parkes 2015.
 */

import { useEffect, useState } from "react";
import ClassDjFaceGrid from "./ClassDjFaceGrid";
import ClassDjVoteForm from "./ClassDjVoteForm";
import type { Mood } from "@/lib/class-dj/types";

interface RoundLike {
  id: string;
  ends_at: string;
  class_round_index: number;
}

interface MyVoteLike {
  mood: Mood;
  energy: number;
  veto: string | null;
  seed: string | null;
}

interface Props {
  round: RoundLike;
  myVote: MyVoteLike | null;
  participationCount: number;
  classSize: number;
}

export default function ClassDjLiveStudentView({
  round,
  myVote,
  participationCount,
  classSize,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((new Date(round.ends_at).getTime() - Date.now()) / 1000)),
  );
  const [showForm, setShowForm] = useState(!myVote);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(
        Math.max(0, Math.ceil((new Date(round.ends_at).getTime() - Date.now()) / 1000)),
      );
    }, 250);
    return () => clearInterval(interval);
  }, [round.ends_at]);

  const cold = round.class_round_index === 1;

  return (
    <div className="my-3 rounded-xl border border-violet-200 bg-white p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-violet-900 flex items-center gap-2">
          <span>🎵</span> Class DJ
          {cold && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">
              Round 1 — still learning your room
            </span>
          )}
        </h3>
        <div
          className="text-2xl font-bold tabular-nums text-violet-700"
          role="timer"
          aria-label={`${secondsLeft} seconds remaining`}
        >
          {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
          {String(secondsLeft % 60).padStart(2, "0")}
        </div>
      </div>

      {/* Face grid — participation only */}
      <ClassDjFaceGrid participationCount={participationCount} classSize={classSize} />

      {/* Vote form OR confirmation */}
      {showForm || !myVote ? (
        <ClassDjVoteForm
          roundId={round.id}
          initialMood={myVote?.mood}
          initialEnergy={myVote?.energy}
          initialVeto={myVote?.veto}
          initialSeed={myVote?.seed}
          onVoted={() => setShowForm(false)}
        />
      ) : (
        <div className="rounded-lg bg-violet-50 border border-violet-200 p-4 text-center">
          <div className="text-2xl mb-1">✅</div>
          <p className="text-sm font-semibold text-violet-900 mb-1">You voted!</p>
          <p className="text-xs text-violet-700">
            {myVote.mood} · energy {myVote.energy}
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-3 text-xs underline text-violet-600 hover:text-violet-800"
          >
            Edit my vote
          </button>
        </div>
      )}
    </div>
  );
}
