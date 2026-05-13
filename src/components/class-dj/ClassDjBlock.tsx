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

import { useClassDjPolling, type Role } from "./useClassDjPolling";
import ClassDjArmedView from "./ClassDjArmedView";
import ClassDjLiveStudentView from "./ClassDjLiveStudentView";
import ClassDjLiveTeacherView from "./ClassDjLiveTeacherView";
import type { Mood } from "@/lib/class-dj/types";

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
  const { state, error, stopped } = useClassDjPolling(role, {
    unitId,
    pageId,
    activityId,
    classId,
  });

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

  // Status === "live" — round is open.
  if (state.status === "live") {
    if (role === "teacher" && state.tally) {
      return (
        <ClassDjLiveTeacherView
          round={round}
          tally={state.tally}
          participationCount={state.participation_count}
          classSize={state.class_size}
        />
      );
    }
    return (
      <ClassDjLiveStudentView
        round={round}
        myVote={myVote}
        participationCount={state.participation_count}
        classSize={state.class_size}
      />
    );
  }

  // Status === "closed" — round ended, but suggestion view ships in Phase 5.
  // For Phase 4 we just show a placeholder that confirms closure.
  return (
    <div className="my-3 rounded-xl border border-violet-200 bg-violet-50/60 p-5 text-center">
      <div className="text-2xl mb-1">🎵</div>
      <h3 className="text-base font-bold text-violet-900 mb-1">
        Class DJ — round {round.class_round_index} closed
      </h3>
      <p className="text-sm text-violet-700">
        {state.participation_count} of {state.class_size} voted.
      </p>
      <p className="text-[11px] text-violet-500 mt-2">
        Suggestion view lands in Phase 5.
      </p>
      {stopped && (
        <p className="text-[10px] text-violet-400 mt-1">
          Polling stopped (round closed or hit 5-min cap).
        </p>
      )}
    </div>
  );
}
