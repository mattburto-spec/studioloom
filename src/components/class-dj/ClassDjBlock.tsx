"use client";

/**
 * Class DJ — top-level block renderer (Phase 4).
 *
 * Mounted by the lesson player dispatch in ResponseInput.tsx when
 * activity.responseType === "class-dj". Orchestrates polling, dispatches
 * to ARMED / LIVE-student / LIVE-teacher / CLOSED views based on the
 * /state response.
 *
 * Role inference: the props pass `role` explicitly because the lesson
 * player itself runs under a known auth context. For student lesson
 * views we pass "student"; for teacher preview / Teaching Mode cockpit
 * we pass "teacher" (latter wires in Phase 6).
 *
 * Brief: docs/projects/class-dj-block-brief.md §7 (UI surface).
 */

import { useEffect, useRef, useState } from "react";
import { useClassDjPolling, type Role } from "./useClassDjPolling";
import ClassDjArmedView from "./ClassDjArmedView";
import ClassDjLiveStudentView from "./ClassDjLiveStudentView";
import ClassDjLiveTeacherView from "./ClassDjLiveTeacherView";
import ClassDjSuggestionView, {
  type SuggestionItem,
} from "./ClassDjSuggestionView";
import type { ConflictMode, Mood } from "@/lib/class-dj/types";
import type { ClassDjConfig } from "@/components/teacher/lesson-editor/BlockPalette.types";

interface Props {
  unitId: string;
  pageId: string;
  activityId: string;
  classId: string;
  role: Role;
  /** Per-instance teacher-configured gate / max-suggestions / timer.
   *  Sourced from ActivitySection.classDjConfig (Phase 3 lesson editor). */
  config?: ClassDjConfig;
}

interface RoundShape {
  id: string;
  ends_at: string;
  class_round_index: number;
  closed_at: string | null;
}

interface MyVoteShape {
  mood: Mood;
  energy: number;
  veto: string | null;
  seed: string | null;
}

export default function ClassDjBlock({
  unitId,
  pageId,
  activityId,
  classId,
  role,
  config,
}: Props) {
  const { state, error, stopped, refetch } = useClassDjPolling(role, {
    unitId,
    pageId,
    activityId,
    classId,
  });

  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  // Per-round ref-guard so the auto-fire useEffect below only fires
  // once per round id, never loops, and survives re-renders.
  const autoFiredRoundRef = useRef<string | null>(null);

  async function requestSuggestion(roundId: string) {
    setRequesting(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/student/class-dj/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          roundId,
          gateMinVotes: config?.gateMinVotes,
          maxSuggestions: config?.maxSuggestions,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRequestError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      // Refetch state — the suggestion row is now persisted and /state
      // will return it on the next poll.
      await refetch();
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRequesting(false);
    }
  }

  // Clear stale requestError when the round changes. Without this, a
  // failed /suggest from a previous round (e.g. 429 "max_suggestions
  // reached") would still display below the live vote form after the
  // teacher hit Run again — confusing because the new round has fresh
  // suggest_count. Caught 14 May 2026 from Matt's classroom smoke.
  const currentRoundId = state?.round
    ? (state.round as unknown as RoundShape).id
    : null;
  useEffect(() => {
    setRequestError(null);
  }, [currentRoundId]);

  // Auto-fire Suggest when the round closes with the gate met and no
  // suggestion was generated. Closes the most-common Class DJ failure
  // mode: students vote, gate is met, but nobody clicks Suggest before
  // the timer expires → round closes with "No suggestion generated."
  //
  // Race-safe by design:
  //   - /api/student/class-dj/suggest does an atomic suggest_count
  //     increment (UPDATE ... WHERE suggest_count < max_suggestions
  //     RETURNING). Only ONE concurrent caller wins; others get 429.
  //   - The winning client's refetch updates their own state; useClassDjPolling
  //     keeps polling for a 15s grace window after close so all other clients
  //     catch the new suggestion on their next poll.
  //
  // Ref-guard prevents a 429 loop by binding the fire to the specific
  // round id — a new round mints a new id, resetting the guard.
  useEffect(() => {
    if (!state?.round) return;
    if (state.status !== "closed") return;
    if (state.suggestion?.items) return; // already have a suggestion
    if (state.participation_count < (config?.gateMinVotes ?? 3)) return;
    if (requesting) return;

    const currentRoundId = (state.round as unknown as RoundShape).id;
    if (autoFiredRoundRef.current === currentRoundId) return;
    autoFiredRoundRef.current = currentRoundId;

    requestSuggestion(currentRoundId);
    // eslint-disable-next-line react-hooks/exhaustive-deps — requestSuggestion
    // is stable enough; we only want to react to the state-shape signals.
  }, [
    state?.status,
    state?.participation_count,
    state?.suggestion?.items,
    state?.round,
    config?.gateMinVotes,
    requesting,
  ]);

  if (error && !state) {
    return (
      <div className="my-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load Class DJ state: {error}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="my-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Loading Class DJ…
      </div>
    );
  }

  // Status === "armed" — no round yet.
  if (state.status === "armed" || !state.round) {
    return <ClassDjArmedView />;
  }

  const round = state.round as unknown as RoundShape;
  const myVote = state.my_vote as unknown as MyVoteShape | null;

  const suggestionItems = (state.suggestion?.items as SuggestionItem[] | undefined) ?? null;
  const conflictMode: ConflictMode = (round as unknown as { conflict_mode: ConflictMode | null }).conflict_mode ?? "consensus";
  const gateThreshold = config?.gateMinVotes ?? 3;
  const gateMet = state.participation_count >= gateThreshold;
  const maxSuggestionsReached = (state.suggestion?.vote_count !== undefined) && false; // Phase 6 reads activity config

  // Status === "live" — round is open.
  if (state.status === "live") {
    if (role === "teacher" && state.tally) {
      return (
        <div>
          <ClassDjLiveTeacherView
            round={round}
            tally={state.tally}
            participationCount={state.participation_count}
            classSize={state.class_size}
          />
          {suggestionItems && (
            <ClassDjSuggestionView
              items={suggestionItems}
              conflictMode={conflictMode}
              voteCount={state.participation_count}
              classSize={state.class_size}
              canRetry={false}
            />
          )}
        </div>
      );
    }
    return (
      <div>
        <ClassDjLiveStudentView
          round={round}
          myVote={myVote}
          participationCount={state.participation_count}
          classSize={state.class_size}
        />

        {/* Suggest 3 — any student can punch it once gate met */}
        {gateMet && !suggestionItems && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => requestSuggestion(round.id)}
              disabled={requesting}
              className="px-5 py-2.5 rounded-md bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {requesting ? "Asking the DJ…" : `Suggest 3 (${state.participation_count} votes in)`}
            </button>
            {requestError && (
              <p className="mt-2 text-xs text-red-600">{requestError}</p>
            )}
          </div>
        )}

        {suggestionItems && (
          <ClassDjSuggestionView
            items={suggestionItems}
            conflictMode={conflictMode}
            voteCount={state.participation_count}
            classSize={state.class_size}
            canRetry={!maxSuggestionsReached}
            onTryAgain={() => requestSuggestion(round.id)}
            isRetrying={requesting}
          />
        )}
      </div>
    );
  }

  // Status === "closed" — round ended. Render the SuggestionView if a
  // suggestion was generated; otherwise show the "no suggestion" placeholder.
  if (suggestionItems) {
    return (
      <ClassDjSuggestionView
        items={suggestionItems}
        conflictMode={conflictMode}
        voteCount={state.participation_count}
        classSize={state.class_size}
        canRetry={false}
      />
    );
  }

  return (
    <div className="my-3 rounded-xl border border-violet-200 bg-violet-50/60 p-5 text-center">
      <div className="text-2xl mb-1">🎵</div>
      <h3 className="text-base font-bold text-violet-900 mb-1">
        Class DJ — round {round.class_round_index} closed
      </h3>
      <p className="text-sm text-violet-700">
        {state.participation_count} of {state.class_size} voted. No suggestion generated.
      </p>
      {stopped && (
        <p className="text-[10px] text-violet-400 mt-1">
          Polling stopped (round closed or hit 5-min cap).
        </p>
      )}
    </div>
  );
}
