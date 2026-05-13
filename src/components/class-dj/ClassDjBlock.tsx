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

import { useState } from "react";
import { useClassDjPolling, type Role } from "./useClassDjPolling";
import ClassDjArmedView from "./ClassDjArmedView";
import ClassDjLiveStudentView from "./ClassDjLiveStudentView";
import ClassDjLiveTeacherView from "./ClassDjLiveTeacherView";
import ClassDjSuggestionView, {
  type SuggestionItem,
} from "./ClassDjSuggestionView";
import type { ConflictMode, Mood } from "@/lib/class-dj/types";

interface Props {
  unitId: string;
  pageId: string;
  activityId: string;
  classId: string;
  role: Role;
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
}: Props) {
  const { state, error, stopped, refetch } = useClassDjPolling(role, {
    unitId,
    pageId,
    activityId,
    classId,
  });

  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  async function requestSuggestion(roundId: string) {
    setRequesting(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/student/class-dj/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ roundId }),
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
  const gateMet = state.participation_count >= 3;
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
