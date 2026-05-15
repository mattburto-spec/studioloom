"use client";

/**
 * Class DJ — Teacher controls (Phase 6, compact sidebar redesign 14 May 2026).
 *
 * Mounted in Teaching Mode cockpit when the active section is class-dj. The
 * cockpit right-aside is 320px wide → ~250-260px effective render area
 * after parent/card padding. Earlier versions stuffed the full
 * ClassDjLiveTeacherView (5-col histograms) + ClassDjSuggestionView
 * (3-col card grid) + 3-col Pick button grid into that space and got cut
 * off / wrapped badly.
 *
 * This rewrite restructures around a sidebar-native compact panel:
 *
 *   - Always-visible status strip (round badge + timer + participation dots)
 *   - State-aware primary handle (full-width): Start / Suggest / Run again
 *   - Secondary handle (smaller): End round / Regenerate
 *   - Vertical suggestion list (48px thumb + name + Pick button per row)
 *   - Collapsible "Show class mood" section keeps the full histograms
 *     accessible without hogging vertical space by default.
 *
 * Students (main lesson player surface, not sidebar-constrained) keep
 * the rich ClassDjSuggestionView 3-col grid via ClassDjBlock.
 *
 * Brief: docs/projects/class-dj-block-brief.md §7 (Teaching Mode cockpit
 * integration) + §5 (API table) + §3.6 (ledger updates on pick).
 */

import { useEffect, useRef, useState } from "react";
import { useClassDjPolling } from "./useClassDjPolling";
import type { SuggestionItem } from "./ClassDjSuggestionView";
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
  const { state, error: pollError, refetch } = useClassDjPolling("teacher", {
    unitId,
    pageId,
    activityId,
    classId,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Per-button disable helper — only disables the SPECIFIC button being
  // clicked, not every button on the panel. Previously `disabled={busy !== null}`
  // blocked Run again whenever the auto-fire suggest was in flight, locking the
  // teacher out for 5-30s. Now Run again can interrupt a stuck auto-fire by
  // launching a fresh round (server-side suggest call completes harmlessly on
  // the now-closed round; new round mints fresh state).
  function isBusy(endpointFragment: string): boolean {
    return busy !== null && busy.includes(endpointFragment);
  }
  // Per-round ref-guard so the auto-fire useEffect below only fires
  // once per round id, never loops, and survives re-renders. Bound to
  // the round id specifically (not just a boolean) so a new round
  // resets the guard automatically.
  const autoFiredRoundRef = useRef<string | null>(null);

  // When state transitions to a stage the teacher needs to act on (round
  // opens, suggestion lands, round closes), scroll the controls into the
  // visible viewport. Otherwise in a tall lesson the bottom buttons (End
  // round / Pick / Run again) sit below the fold and the teacher has to
  // hunt for them via sidebar scroll. block: "nearest" prevents jolt
  // when controls are already visible.
  const status = state?.status;
  const suggestionLanded = Boolean(state?.suggestion?.items);
  useEffect(() => {
    if (status === "live" || status === "closed") {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [status, suggestionLanded]);

  // Clear stale actionError when the round changes. Without this, a
  // 429 from a previous round's auto-fire (max_suggestions reached)
  // would still display in the teacher panel after Run again.
  const currentRoundId = state?.round
    ? (state.round as unknown as RoundShape).id
    : null;
  useEffect(() => {
    setActionError(null);
  }, [currentRoundId]);

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
    return post("/api/student/class-dj/suggest", {
      roundId,
      gateMinVotes: config?.gateMinVotes,
      maxSuggestions: config?.maxSuggestions,
    });
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

  // Auto-fire Suggest when round closes with gate met and no suggestion.
  //
  // Closes the most-common Class DJ failure mode caught in Matt's
  // classroom smoke: round timer expired with 8/12 votes (gate met) but
  // no suggestion was generated because nobody clicked Suggest before
  // close — students had moved on, teacher's stale vote count showed
  // "Need 1 more" when server already had enough.
  //
  // We auto-fire from BOTH the teacher cockpit (here) and the student
  // ClassDjBlock. Belt-and-braces: works whether teacher OR students are
  // still on the page when the round closes. Server-side /suggest is
  // race-safe via atomic suggest_count increment — concurrent fires get
  // a single winner; others get 429 (max reached).
  //
  // /suggest auth was relaxed 14 May 2026 to accept teacher OR student
  // sessions so the cockpit's fire works.
  //
  // Ref-guard bound to the round id prevents 429 loops AND auto-resets
  // when a new round mints a new id.
  useEffect(() => {
    if (!state?.round) return;
    if (state.status !== "closed") return;
    if (state.suggestion?.items) return;
    if (state.participation_count < (config?.gateMinVotes ?? 3)) return;
    if (busy) return;

    const round = state.round as unknown as RoundShape;
    if (autoFiredRoundRef.current === round.id) return;
    autoFiredRoundRef.current = round.id;

    handleSuggest(round.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps — handleSuggest is
    // stable for our purposes; we only react to state-shape signals.
  }, [
    state?.status,
    state?.suggestion?.items,
    state?.participation_count,
    state?.round,
    config?.gateMinVotes,
    busy,
  ]);

  if (!state) {
    // Surface poll errors so a 4xx (e.g. wrong class, missing
    // enrollment, server bug) doesn't render as a forever-loading
    // placeholder. Lesson banked from the post-Phase-6 has_class_role
    // RPC bug — the loading state was hiding a 403.
    if (pollError) {
      return (
        <div className="my-2 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
          Couldn&apos;t load Class DJ: {pollError}
        </div>
      );
    }
    return (
      <div className="my-2 rounded-md border border-violet-200 bg-violet-50 p-2 text-[11px] text-violet-700">
        Loading Class DJ…
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // ARMED — no round yet. Single big "Start" handle, config summary.
  // ─────────────────────────────────────────────────────────────────
  if (state.status === "armed" || !state.round) {
    return (
      <div ref={rootRef} className="my-2 rounded-lg border border-violet-200 bg-white p-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[12px] font-bold text-violet-900 flex items-center gap-1">
            <span>🎵</span> Class DJ
          </span>
          {config && (
            <span className="text-[9.5px] text-violet-600 tabular-nums whitespace-nowrap">
              {config.timerSeconds ?? 60}s · gate {config.gateMinVotes ?? 3}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLaunch}
          disabled={isBusy("launch")}
          className="w-full px-3 py-2.5 rounded-md bg-violet-600 text-white font-semibold text-[12.5px] hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {busy === "/api/teacher/class-dj/launch" ? "Starting…" : "▶ Start round"}
        </button>
        {actionError && (
          <p className="mt-1.5 text-[11px] text-red-600">{actionError}</p>
        )}
      </div>
    );
  }

  const round = state.round as unknown as RoundShape;
  const suggestionItems = (state.suggestion?.items as SuggestionItem[] | undefined) ?? null;
  const conflictMode: ConflictMode = round.conflict_mode ?? "consensus";
  const gateThreshold = config?.gateMinVotes ?? 3;
  const gateMet = state.participation_count >= gateThreshold;

  // ─────────────────────────────────────────────────────────────────
  // LIVE — round open. Compact status + state-aware primary handle.
  // ─────────────────────────────────────────────────────────────────
  if (state.status === "live") {
    return (
      <div ref={rootRef} className="my-2 rounded-lg border-2 border-violet-300 bg-white p-2.5 shadow-sm space-y-2">
        <StatusStrip
          roundIndex={round.class_round_index}
          endsAt={round.ends_at}
          voted={state.participation_count}
          total={state.class_size}
          isLive
        />

        {/* Suggestion landed → compact picks + retry/regenerate */}
        {suggestionItems && (
          <>
            <SuggestionPickList
              items={suggestionItems}
              roundId={round.id}
              onPick={(idx) => handlePick(round.id, idx)}
              busy={busy}
            />
            <div className="flex items-center justify-between text-[10.5px] text-violet-700">
              <button
                type="button"
                onClick={() => handleRegenerate(round.id)}
                disabled={isBusy("regenerate")}
                className="underline hover:text-violet-900 disabled:opacity-50"
              >
                {busy?.includes("regenerate") ? "…" : "Regenerate why-lines"}
              </button>
              <button
                type="button"
                onClick={() => handleSuggest(round.id)}
                disabled={isBusy("suggest")}
                className="underline hover:text-violet-900 disabled:opacity-50"
              >
                {busy?.includes("suggest") ? "…" : "Try another 3"}
              </button>
            </div>
          </>
        )}

        {/* No suggestion yet → state-aware primary handle */}
        {!suggestionItems && (
          <button
            type="button"
            onClick={() => handleSuggest(round.id)}
            disabled={!gateMet || isBusy("suggest")}
            className="w-full px-3 py-2.5 rounded-md bg-violet-600 text-white font-semibold text-[12.5px] hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {busy?.includes("suggest")
              ? "Asking the DJ…"
              : gateMet
              ? `🎯 Suggest 3 (${state.participation_count} in)`
              : `Need ${gateThreshold - state.participation_count} more`}
          </button>
        )}

        {/* End round early — always visible as a handle during LIVE */}
        <button
          type="button"
          onClick={() => handleClose(round.id)}
          disabled={isBusy("close")}
          className="w-full px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-[11.5px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy?.includes("close") ? "Ending…" : "End round early"}
        </button>

        {/* Mood histograms intentionally NOT rendered inline here — even
            collapsed, the <details> disclosure was adding height that pushed
            the bottom action buttons below the visible viewport in shorter
            laptops. Full mood/energy view will live in a future modal/
            drawer (FU-CLASS-DJ-TEACHER-MOOD-MODAL). For now teachers
            read the room via the participation count + suggestion's
            narration ("Just you voting, so here's The Lumineers — folk
            vibes, steady energy, pure focus") which already encodes the
            algorithm's read of the room. */}

        {actionError && (
          <p className="text-[11px] text-red-600">{actionError}</p>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // CLOSED — picks (if any) + Run again handle.
  // ─────────────────────────────────────────────────────────────────
  return (
    <div ref={rootRef} className="my-2 rounded-lg border border-violet-200 bg-white p-2.5 shadow-sm space-y-2">
      <StatusStrip
        roundIndex={round.class_round_index}
        endsAt={round.ends_at}
        voted={state.participation_count}
        total={state.class_size}
        isLive={false}
      />

      {suggestionItems ? (
        <>
          <SuggestionPickList
            items={suggestionItems}
            roundId={round.id}
            onPick={(idx) => handlePick(round.id, idx)}
            busy={busy}
          />
          <button
            type="button"
            onClick={() => handleRegenerate(round.id)}
            disabled={isBusy("regenerate")}
            className="block text-[10.5px] text-violet-700 underline hover:text-violet-900 disabled:opacity-50"
          >
            {busy?.includes("regenerate") ? "Regenerating…" : "Regenerate why-lines"}
          </button>
          {/* Conflict mode chip for context — purely informational */}
          <ConflictModeChip mode={conflictMode} />
        </>
      ) : (
        <p className="text-[11.5px] text-violet-700 text-center py-1">
          Round closed — no suggestion generated.
        </p>
      )}

      <button
        type="button"
        onClick={handleLaunch}
        disabled={isBusy("launch")}
        className="w-full px-3 py-2.5 rounded-md bg-violet-600 text-white font-semibold text-[12.5px] hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {busy?.includes("launch") ? "Starting…" : "▶ Run again"}
      </button>
      {actionError && (
        <p className="text-[11px] text-red-600">{actionError}</p>
      )}
    </div>
  );
}

/**
 * Compact status strip — round badge + live timer + participation dots.
 * One row, sidebar-width-friendly. Used in LIVE and CLOSED branches.
 */
function StatusStrip({
  roundIndex,
  endsAt,
  voted,
  total,
  isLive,
}: {
  roundIndex: number;
  endsAt: string;
  voted: number;
  total: number;
  isLive: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setSecondsLeft(
        Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)),
      );
    }, 500);
    return () => clearInterval(interval);
  }, [endsAt, isLive]);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[12px] font-bold text-violet-900 flex items-center gap-1 whitespace-nowrap">
          <span>🎵</span> Round {roundIndex}
        </span>
        {!isLive && (
          <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            closed
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isLive && (
          <span
            className="text-[14px] font-bold tabular-nums text-violet-700"
            aria-label={`${secondsLeft} seconds remaining`}
          >
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </span>
        )}
        <span className="text-[10.5px] text-violet-600 tabular-nums whitespace-nowrap">
          {voted}/{total}
        </span>
      </div>
    </div>
  );
}

/**
 * Vertical suggestion list — one row per pick with 48px thumbnail +
 * name + small Pick button. Replaces the 3-col grid that didn't fit
 * in the 260px sidebar.
 */
function SuggestionPickList({
  items,
  onPick,
  busy,
}: {
  items: SuggestionItem[];
  roundId: string;
  onPick: (index: 0 | 1 | 2) => void;
  busy: string | null;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div
          key={`pick-${i}`}
          className={`flex items-center gap-2 rounded-md p-1.5 ${
            it.is_bridge ? "bg-amber-50 border border-amber-200" : "bg-violet-50/50 border border-violet-100"
          }`}
        >
          {it.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={it.image_url}
              alt=""
              className="w-10 h-10 rounded object-cover flex-shrink-0 bg-gray-100"
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gradient-to-br from-violet-200 to-violet-300 flex items-center justify-center text-base flex-shrink-0">
              🎵
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-bold text-gray-900 leading-tight truncate" title={it.name}>
              {it.name}
            </p>
            <p className="text-[9.5px] uppercase tracking-wider text-gray-500 truncate">
              {it.kind}
              {it.is_bridge && <span className="ml-1 text-amber-700 font-semibold">· BRIDGE</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPick(i as 0 | 1 | 2)}
            disabled={busy?.includes("/pick") ?? false}
            className="px-2 py-1 rounded bg-violet-600 text-white text-[10.5px] font-semibold hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {busy?.includes("/pick") ? "…" : "Pick →"}
          </button>
        </div>
      ))}
    </div>
  );
}

function ConflictModeChip({ mode }: { mode: ConflictMode }) {
  const config = {
    consensus: { emoji: "🎯", label: "Consensus", color: "text-violet-600" },
    split: { emoji: "↔️", label: "Split — bridge pick added", color: "text-amber-700" },
    small_group: { emoji: "🤝", label: "Small class", color: "text-violet-600" },
  }[mode];
  return (
    <p className={`text-[10px] ${config.color} flex items-center gap-1`}>
      <span>{config.emoji}</span> {config.label}
    </p>
  );
}
