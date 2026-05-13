"use client";

/**
 * Class DJ — Teacher controls (Phase 6).
 *
 * Mounted in Teaching Mode cockpit when the active section is class-dj.
 * Orchestrates the full teacher action set:
 *   - ARMED   → "Start round" button (POST /launch)
 *   - LIVE    → "Suggest now" (POST /suggest) + "End round" (POST /close)
 *   - CLOSED  → "Pick this one →" per card (POST /pick) + "Run again"
 *               (POST /launch) + "Regenerate narration" (POST /regenerate)
 *
 * Uses the existing useClassDjPolling hook (1s teacher cadence). The
 * student-facing UI (vote form etc.) does NOT mount here — only the
 * teacher view.
 *
 * Brief: docs/projects/class-dj-block-brief.md §7 (Teaching Mode cockpit
 * integration) + §5 (API table) + §3.6 (ledger updates on pick).
 */

import { useState } from "react";
import { useClassDjPolling } from "./useClassDjPolling";
import ClassDjLiveTeacherView from "./ClassDjLiveTeacherView";
import ClassDjSuggestionView, { type SuggestionItem } from "./ClassDjSuggestionView";
import type { ConflictMode } from "@/lib/class-dj/types";

interface Props {
  unitId: string;
  pageId: string;
  activityId: string;
  classId: string;
  /** Per-instance config from activity.classDjConfig (Phase 3). */
  config?: {
    timerSeconds?: number;
    gateMinVotes?: number;
    maxSuggestions?: number;
  };
}

interface RoundShape {
  id: string;
  ends_at: string;
  class_round_index: number;
  closed_at: string | null;
  conflict_mode?: ConflictMode | null;
}

export default function ClassDjTeacherControls({
  unitId,
  pageId,
  activityId,
  classId,
  config,
}: Props) {
  const { state, refetch } = useClassDjPolling("teacher", {
    unitId,
    pageId,
    activityId,
    classId,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function post(path: string, body?: Record<string, unknown>): Promise<unknown | null> {
    setBusy(path);
    setActionError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: body ? JSON.stringify(body) : undefined,
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((responseBody as { error?: string }).error ?? `HTTP ${res.status}`);
        return null;
      }
      await refetch();
      return responseBody;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error");
      return null;
    } finally {
      setBusy(null);
    }
  }

  function handleLaunch() {
    return post("/api/teacher/class-dj/launch", {
      unitId,
      pageId,
      activityId,
      classId,
      durationSeconds: config?.timerSeconds ?? 60,
    });
  }

  function handleSuggest(roundId: string) {
    // Teachers hit the same endpoint students hit — auth is student OR
    // teacher; the route accepts either. (Phase 5 wired suggest to
    // requireStudentSession; we could relax to either-role here but for
    // Phase 6 MVP teachers can use the student fetch by going through
    // /api/student/class-dj/suggest as a session-cookie holder. If the
    // cockpit hits this and the session is teacher-only without student
    // cookie, this returns 401 — fileable as FU-DJ-TEACHER-SUGGEST.)
    return post("/api/student/class-dj/suggest", { roundId });
  }

  function handleClose(roundId: string) {
    return post(`/api/teacher/class-dj/${roundId}/close`);
  }

  function handlePick(roundId: string, index: 0 | 1 | 2) {
    return post(`/api/teacher/class-dj/${roundId}/pick`, { suggestionIndex: index });
  }

  function handleRegenerate(roundId: string) {
    return post(`/api/teacher/class-dj/${roundId}/regenerate-narration`);
  }

  if (!state) {
    return (
      <div className="my-3 rounded-md border border-violet-200 bg-violet-50 p-3 text-xs text-violet-700">
        Loading Class DJ controls…
      </div>
    );
  }

  // ARMED — no round yet.
  if (state.status === "armed" || !state.round) {
    return (
      <div className="my-3 rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-violet-900 flex items-center gap-2">
            <span>🎵</span> Class DJ — ready to launch
          </h3>
          {config && (
            <span className="text-[11px] text-violet-600">
              {config.timerSeconds ?? 60}s · gate {config.gateMinVotes ?? 3} · max {config.maxSuggestions ?? 3}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLaunch}
          disabled={busy !== null}
          className="w-full px-4 py-3 rounded-md bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {busy === "/api/teacher/class-dj/launch" ? "Starting…" : "Start round"}
        </button>
        {actionError && (
          <p className="mt-2 text-xs text-red-600">{actionError}</p>
        )}
      </div>
    );
  }

  const round = state.round as unknown as RoundShape;
  const suggestionItems = (state.suggestion?.items as SuggestionItem[] | undefined) ?? null;
  const conflictMode: ConflictMode = round.conflict_mode ?? "consensus";
  const gateMet = state.participation_count >= (config?.gateMinVotes ?? 3);

  // LIVE — round is open.
  if (state.status === "live") {
    return (
      <div>
        {state.tally && (
          <ClassDjLiveTeacherView
            round={round}
            tally={state.tally}
            participationCount={state.participation_count}
            classSize={state.class_size}
          />
        )}

        {!suggestionItems && (
          <div className="my-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleSuggest(round.id)}
              disabled={!gateMet || busy !== null}
              className="flex-1 px-4 py-2.5 rounded-md bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {busy?.includes("suggest")
                ? "Asking the DJ…"
                : gateMet
                ? `Suggest 3 (${state.participation_count} votes in)`
                : `Suggest 3 — need ${(config?.gateMinVotes ?? 3) - state.participation_count} more vote(s)`}
            </button>
            <button
              type="button"
              onClick={() => handleClose(round.id)}
              disabled={busy !== null}
              className="px-4 py-2.5 rounded-md border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              End round
            </button>
          </div>
        )}

        {suggestionItems && (
          <SuggestionViewWithPicks
            items={suggestionItems}
            conflictMode={conflictMode}
            voteCount={state.participation_count}
            classSize={state.class_size}
            roundId={round.id}
            onPick={(idx) => handlePick(round.id, idx)}
            onTryAgain={() => handleSuggest(round.id)}
            onRegenerate={() => handleRegenerate(round.id)}
            busy={busy}
          />
        )}

        {actionError && (
          <p className="mt-2 text-xs text-red-600">{actionError}</p>
        )}
      </div>
    );
  }

  // CLOSED.
  return (
    <div>
      {suggestionItems ? (
        <SuggestionViewWithPicks
          items={suggestionItems}
          conflictMode={conflictMode}
          voteCount={state.participation_count}
          classSize={state.class_size}
          roundId={round.id}
          onPick={(idx) => handlePick(round.id, idx)}
          onTryAgain={undefined}
          onRegenerate={() => handleRegenerate(round.id)}
          busy={busy}
        />
      ) : (
        <div className="my-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-center">
          <p className="text-sm text-violet-700">
            Round {round.class_round_index} closed without a suggestion.
          </p>
        </div>
      )}
      <div className="mt-2">
        <button
          type="button"
          onClick={handleLaunch}
          disabled={busy !== null}
          className="w-full px-4 py-2.5 rounded-md bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {busy?.includes("launch") ? "Starting…" : "Run again"}
        </button>
      </div>
      {actionError && (
        <p className="mt-2 text-xs text-red-600">{actionError}</p>
      )}
    </div>
  );
}

/**
 * Teacher-side suggestion view with Pick CTAs per card and a
 * Regenerate-narration button. Wraps the read-only SuggestionView from
 * Phase 5 and adds the interactive overlay.
 */
function SuggestionViewWithPicks({
  items,
  conflictMode,
  voteCount,
  classSize,
  onPick,
  onTryAgain,
  onRegenerate,
  busy,
}: {
  items: SuggestionItem[];
  conflictMode: ConflictMode;
  voteCount: number;
  classSize: number;
  roundId: string;
  onPick: (index: 0 | 1 | 2) => void;
  onTryAgain?: () => void;
  onRegenerate: () => void;
  busy: string | null;
}) {
  return (
    <div>
      <ClassDjSuggestionView
        items={items}
        conflictMode={conflictMode}
        voteCount={voteCount}
        classSize={classSize}
        canRetry={!!onTryAgain}
        onTryAgain={onTryAgain}
        isRetrying={busy?.includes("suggest") ?? false}
      />
      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
        {items.map((it, i) => (
          <button
            key={`pick-${i}`}
            type="button"
            onClick={() => onPick(i as 0 | 1 | 2)}
            disabled={busy !== null}
            className="px-3 py-2 rounded-md bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {busy?.includes("/pick") ? "Picking…" : `Pick ${it.name} →`}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy !== null}
          className="text-xs underline text-violet-600 hover:text-violet-800 disabled:opacity-50"
        >
          {busy?.includes("regenerate") ? "Regenerating narration…" : "Regenerate why-lines"}
        </button>
      </div>
    </div>
  );
}
