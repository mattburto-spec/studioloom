"use client";

/**
 * AG.2.3b — KanbanBoard
 *
 * Top-level component. Mounts in the student unit page (TBD location —
 * AG.2.4 wires this up). Renders 4 columns + handles modal state +
 * delegates persistence to useKanbanBoard hook.
 *
 * Pure orchestration — no fetch logic here (lives in the hook).
 */

import { useCallback, useRef, useState } from "react";
import type { PanInfo } from "framer-motion";
import {
  KANBAN_COLUMNS,
  type KanbanColumn as KanbanColumnId,
  type BlockType,
} from "@/lib/unit-tools/kanban/types";
import {
  cardsByStatus,
  estimateAccuracy,
  validateMove,
} from "@/lib/unit-tools/kanban/reducer";
import {
  classifyDrop,
  findDropTargetColumn,
  type ColumnRect,
} from "@/lib/unit-tools/kanban/drag-drop";
import KanbanColumn from "./KanbanColumn";
import KanbanCardModal, { type ModalMode } from "./KanbanCardModal";
import KanbanAddCardModal from "./KanbanAddCardModal";
import { useKanbanBoard } from "./use-kanban-board";

interface KanbanBoardProps {
  unitId: string;
}

const COLUMN_META: Record<
  KanbanColumnId,
  { title: string; description: string; allowAdd: boolean }
> = {
  backlog: {
    title: "Backlog",
    description: "Things you might do. Add freely.",
    allowAdd: true,
  },
  this_class: {
    title: "This Class",
    description: "Committed for today. Pull from Backlog.",
    allowAdd: true,
  },
  doing: {
    title: "Doing",
    description: "Finish before you start something else.",
    allowAdd: false,
  },
  done: {
    title: "Done",
    description: "Completed with a Definition of Done met.",
    allowAdd: false,
  },
};

export default function KanbanBoard({ unitId }: KanbanBoardProps) {
  const board = useKanbanBoard({ unitId });
  const { state, loadStatus, loadError, save, dispatch, flushSave } = board;

  // Modal state — independent of the hook's persistence layer
  const [openCardIdRaw, setOpenCardIdRaw] = useState<string | null>(null);
  const openCardId = openCardIdRaw;
  // Round 36 (7 May 2026 AM, NIS Class 1) — DIAGNOSTIC INSTRUMENTATION.
  // 4 layers of click suppression couldn't fix the modal-on-drop, so
  // the modal is probably NOT being opened by a click event we can
  // intercept. This wrapper logs every call to setOpenCardId with a
  // stack trace, so the next time Matt sees the modal pop on drop,
  // DevTools console will show the EXACT call path. We can then
  // surgically fix that path instead of guessing.
  //
  // Wrapped so all existing call sites (handleCardDragEnd's
  // "needsModal" case, openCardModal, closeCardModal) flow through
  // here without code change.
  const setOpenCardId = useCallback((value: string | null) => {
    if (value !== null) {
      // eslint-disable-next-line no-console
      console.trace("[kanban] setOpenCardId called with", value);
    }
    setOpenCardIdRaw(value);
  }, []);
  const [modalMode, setModalMode] = useState<ModalMode>("edit");
  const [moveTarget, setMoveTarget] = useState<KanbanColumnId | null>(null);

  // Round 19 — drag-and-drop state
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [hoverColumnId, setHoverColumnId] = useState<KanbanColumnId | null>(null);
  const [dropToast, setDropToast] = useState<string | null>(null);
  const columnElsRef = useRef<Map<KanbanColumnId, HTMLElement | null>>(
    new Map()
  );

  // Round 21 — Add Card composer state. Null when closed; the target
  // column when open. Replaces the v1 native window-prompt flow.
  const [addCardForColumn, setAddCardForColumn] =
    useState<KanbanColumnId | null>(null);

  // Round 21 — drag-end ghost-click suppression. Framer Motion releases
  // pointer events at drag-end; if the dropped card lands on top of the
  // "+ Add card" button, that button's onClick fires the synthetic
  // click and the Add modal opens unintentionally. We set this ref for
  // ~350ms after a drag ends to swallow any clicks during that window.
  //
  // Round 23 → Round 26 (6 May 2026 PM) — earlier we tried mirroring
  // the ref into a `suppressCardClick` state and propagating it down
  // through KanbanColumn → KanbanCard.suppressClick. That was wrong:
  // the React state setter is async, so the synthetic click fires
  // with stale prop value before React re-renders. Matt's repro:
  // dragged a card → modal still opened.
  //
  // Round 26 fix: synchronous ref check at the BOARD level. handleCardClick
  // wraps openCardModal and bails when the ref says we just dropped a
  // card. No state, no prop propagation, no render-timing race.
  //
  // Round 35 (7 May 2026 AM, NIS Class 1) — REVERTED rounds 31 / 33 /
  // 34. Per Matt during Class 1: "now the column doesnt glow purple
  // anymore when i drag a card onto it, the cards dont stay and the
  // popups are still there". The progressively-aggressive click
  // suppression (round 31 capture-phase handler, round 33 pointer-
  // events:none mutation, round 34 document-level capture handler)
  // collectively interfered with framer-motion's pointer event
  // detection, breaking drag mechanics entirely.
  //
  // Drag-working-with-modal > no-drag-no-modal. Reverted to round-26
  // baseline (handleCardClick gate). Modal-on-drop is now a known
  // outstanding bug — needs `setOpenCardId` instrumentation to find
  // the actual code path opening it. Filed post-class.
  const dragJustEndedRef = useRef<number>(0);

  // Round 37 (7 May 2026 AM, NIS Class 1) — THE ACTUAL FIX.
  //
  // Round 36's console.trace instrumentation caught the bug live.
  // Trace showed:
  //   1. dragEnd fired (offset 363, real drag movement)
  //   2. setOpenCardId called (modal opens)
  //   3. dragEnd fired AGAIN (offset -282 — the snap-back animation!)
  //
  // framer-motion fires onDragEnd TWICE per drag in our setup —
  // once for the real drag, once when dragSnapToOrigin animates the
  // card back. The click event fires BETWEEN these two events.
  //
  // The previous gate (Date.now() - dragJustEndedRef.current < 1000)
  // SHOULD have caught the click in this window — the first dragEnd
  // stamps the ref, then click fires within milliseconds, gate sees
  // sinceDragMs ≈ 5ms < 1000 → suppress. But the modal still opens.
  //
  // Conclusion: handleCardClick's gate isn't reaching the click event,
  // OR the click is bypassing handleCardClick entirely. Either way,
  // a TIMESTAMP-based gate isn't reliable.
  //
  // Switch to a STATEFUL flag: `isDraggingRef` is true from the
  // moment dragStart fires until 350ms after dragEnd. Updated
  // synchronously at the ref level so no render-timing race.
  // handleCardClick bails immediately if isDraggingRef.current
  // is true. The 350ms post-dragEnd buffer covers the snap-back
  // animation + any deferred synthetic clicks.
  const isDraggingRef = useRef<boolean>(false);
  // Tracks the pending "release isDraggingRef" timeout so back-to-back
  // drags don't race — each new dragStart cancels the previous release.
  const dragReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Round 39 (7 May 2026, post-Class-1) — phantom dragEnd guard.
  // framer-motion fires onDragEnd TWICE per drag (real drop + snap-back
  // animation, see round 37). Round 37 stopped the modal opening from
  // the click between them. This guard stops the SECOND dragEnd from
  // re-running classifyDrop / dispatching moveCard. Symptom without
  // it: card lands in new column, then "flies back" because the
  // snap-back's info.point lands near the origin column and looks like
  // a valid move from the (now-updated) card.status back to origin.
  // Set at dragStart, cleared by the first dragEnd. Second dragEnd
  // sees null and bails before any state change.
  const activeDragCardRef = useRef<string | null>(null);

  const registerColumnEl = useCallback(
    (id: KanbanColumnId, el: HTMLElement | null) => {
      columnElsRef.current.set(id, el);
    },
    []
  );

  /** Capture column rects from the registered DOM nodes. */
  function readColumnRects(): ColumnRect[] {
    const rects: ColumnRect[] = [];
    for (const [columnId, el] of columnElsRef.current) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      rects.push({
        columnId,
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      });
    }
    return rects;
  }

  function handleCardDragStart(cardId: string) {
    setDraggingCardId(cardId);
    setHoverColumnId(null);
    // Round 37 — flip the stateful flag at dragStart and cancel any
    // pending release from a previous drag. From this moment until
    // 350ms after dragEnd, handleCardClick / handleAddCard bail.
    // Refs don't trigger re-renders so this is safe (the round-28
    // breakage was unrelated — that round added a TIMESTAMP stamp
    // here that some downstream gate misread; this is just a boolean).
    isDraggingRef.current = true;
    if (dragReleaseTimeoutRef.current !== null) {
      clearTimeout(dragReleaseTimeoutRef.current);
      dragReleaseTimeoutRef.current = null;
    }
    // Round 39 — claim ownership of the drag session for this card.
    // The first dragEnd will clear this; the phantom second dragEnd
    // will see null and bail.
    activeDragCardRef.current = cardId;
  }

  // Round 38 (7 May 2026, NIS Class 1) — coord-system bug.
  // framer-motion's `info.point` returns PAGE coords (event.pageX/Y,
  // include document scroll) while getBoundingClientRect() returns
  // VIEWPORT coords (no scroll). When the page is scrolled at all,
  // info.point.y > rect.bottom for every column and findDropTargetColumn
  // returns null → no glow → drop classified as noop → card snaps back.
  // Symptom: works when scrollY=0, breaks when user scrolls. This was
  // latent since round 19 — surfaced now that the student dashboard is
  // tall enough to scroll on more viewports.
  // Fix: convert info.point from page → viewport by subtracting scroll.
  function viewportPoint(info: PanInfo): { x: number; y: number } {
    return {
      x: info.point.x - window.scrollX,
      y: info.point.y - window.scrollY,
    };
  }

  function handleCardDrag(_cardId: string, info: PanInfo) {
    const rects = readColumnRects();
    const target = findDropTargetColumn(viewportPoint(info), rects);
    setHoverColumnId(target);
  }

  function handleCardDragEnd(cardId: string, info: PanInfo) {
    // Round 39 — phantom dragEnd guard. framer-motion fires onDragEnd
    // twice per drag in our setup (real + snap-back). Only the FIRST
    // fire should run classify/dispatch logic. The second sees a
    // cleared ref and bails before touching any state.
    if (activeDragCardRef.current !== cardId) {
      // eslint-disable-next-line no-console
      console.warn("[kanban] phantom dragEnd ignored", {
        cardId,
        offsetX: info.offset?.x,
        offsetY: info.offset?.y,
      });
      return;
    }
    activeDragCardRef.current = null;

    const card = state.cards.find((c) => c.id === cardId);
    setDraggingCardId(null);
    setHoverColumnId(null);
    // Round 21 + 26 — stamp the moment the drag ended.
    // handleAddCard + handleCardClick gate on this ref synchronously.
    // Round 35 (7 May 2026 AM) reverted the round-33 pointer-events
    // mutation along with round-34 doc-level handler; both broke drag
    // mechanics. Drag-with-modal-popup > no-drag.
    dragJustEndedRef.current = Date.now();
    // Round 37 — schedule release of the stateful drag flag. 350ms
    // covers framer-motion's snap-back animation (which fires a
    // SECOND dragEnd) and any synthetic click that may follow. Any
    // existing pending release was already cleared at dragStart, but
    // we defensively clear here too in case dragEnd fires twice
    // (which it does — that's the bug we're working around).
    if (dragReleaseTimeoutRef.current !== null) {
      clearTimeout(dragReleaseTimeoutRef.current);
    }
    dragReleaseTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false;
      dragReleaseTimeoutRef.current = null;
    }, 350);
    // eslint-disable-next-line no-console
    console.warn("[kanban] dragEnd fired", {
      cardId,
      offsetX: info.offset?.x,
      offsetY: info.offset?.y,
    });
    if (!card) return;

    const rects = readColumnRects();
    const target = findDropTargetColumn(viewportPoint(info), rects);
    const action = classifyDrop(state, card, target);

    switch (action.kind) {
      case "noop":
        // Snap back via dragSnapToOrigin; nothing else to do.
        return;
      case "blocked":
        setDropToast(action.reason);
        setTimeout(() => setDropToast(null), 2400);
        return;
      case "ok":
        dispatch({
          type: "moveCard",
          cardId: card.id,
          toStatus: action.toStatus,
        });
        return;
      case "needsModal":
        // Open the modal pre-set on move-to mode + target column.
        // Existing modal flow handles DoD / estimate / because.
        setOpenCardId(card.id);
        setModalMode("move-to");
        setMoveTarget(action.toStatus);
        return;
    }
  }

  function openCardModal(cardId: string, mode: ModalMode = "edit") {
    setOpenCardId(cardId);
    setModalMode(mode);
    setMoveTarget(null);
  }

  // Round 26 — synchronous ref-check wrapper around card clicks.
  // KanbanCard's onClick comes through KanbanColumn.onCardClick which
  // is bound to THIS function, so the guard runs at click time on the
  // latest ref value rather than on a stale prop value.
  //
  // Round 28 — window bumped 350ms → 1000ms after Matt repro'd "popups
  // each time i move a card" with the round-26 fix live. The
  // dragJustEndedRef is also stamped on drag-START now, so this gate
  // covers the entire drag duration + 1s after — defends against
  // touch devices / browsers where the synthetic click fires hundreds
  // of ms after pointerup. 1000ms is still well under the duration of
  // a deliberate click (which typically takes 50-200ms on touch).
  function handleCardClick(cardId: string) {
    // Round 37 — primary gate. isDraggingRef is true from dragStart
    // until 350ms after dragEnd, regardless of how many times
    // framer-motion fires onDragEnd or where the synthetic click
    // lands in the sequence. Synchronous, no render-timing race.
    if (isDraggingRef.current) {
      // eslint-disable-next-line no-console
      console.warn("[kanban] click suppressed by isDraggingRef", { cardId });
      return;
    }
    // Round 28 — belt-and-suspenders timestamp gate kept in case the
    // ref-flag misses an edge case (e.g. release fired early due to a
    // missed dragEnd). 1000ms covers the entire drag + click-delay
    // window across browsers / devices.
    const sinceDragMs = Date.now() - dragJustEndedRef.current;
    if (sinceDragMs < 1000) {
      // eslint-disable-next-line no-console
      console.warn(
        "[kanban] click suppressed at handleCardClick (timestamp gate)",
        { cardId, sinceDragMs }
      );
      return;
    }
    openCardModal(cardId);
  }

  function closeCardModal() {
    setOpenCardId(null);
    setMoveTarget(null);
  }

  function handleAddCard(toStatus: KanbanColumnId) {
    // Round 37 — same dual-gate as handleCardClick. The Add-card
    // button is on the same surface as cards, so the ghost-click
    // problem applies identically.
    if (isDraggingRef.current) return;
    if (Date.now() - dragJustEndedRef.current < 1000) return;
    setAddCardForColumn(toStatus);
  }

  function handleAddCardSubmit(title: string) {
    if (!addCardForColumn) return;
    dispatch({ type: "createCard", title, status: addCardForColumn });
    setAddCardForColumn(null);
  }

  const accuracy = estimateAccuracy(state);

  // ─── LOAD STATES ───────────────────────────────────────────────────────────

  if (loadStatus === "loading" || loadStatus === "idle") {
    return (
      <div
        className="text-[12px] text-gray-500 italic p-4"
        data-testid="kanban-loading"
      >
        Loading your board...
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div
        className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-3"
        data-testid="kanban-load-error"
      >
        Couldn&apos;t load Kanban: {loadError ?? "unknown error"}.{" "}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="underline underline-offset-2"
        >
          Reload
        </button>
      </div>
    );
  }

  const openCard = openCardId
    ? state.cards.find((c) => c.id === openCardId) ?? null
    : null;

  // ─── BOARD ────────────────────────────────────────────────────────────────

  // Round 35 (7 May 2026 AM, NIS Class 1) — REVERTED round-31's
  // handleBoardClickCapture + onClickCapture, and the boardRootRef.
  // Both contributed to the drag breakage Matt reported live.

  return (
    <div
      className="flex flex-col gap-3"
      data-testid="kanban-board"
      data-unit-id={unitId}
    >
      {/* Save indicator + estimate calibration */}
      <div className="flex items-center gap-2 text-[10.5px] text-gray-500">
        <span className="font-extrabold uppercase tracking-wider text-gray-700">
          Project board
        </span>
        <span
          className="inline-block w-1 h-1 rounded-full bg-gray-300"
          aria-hidden="true"
        />
        {save.isSaving ? (
          <span
            className="inline-flex items-center gap-1 text-violet-700 font-semibold"
            data-testid="kanban-save-status"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Saving…
          </span>
        ) : save.error ? (
          <span
            className="inline-flex items-center gap-1 text-rose-700 font-semibold"
            data-testid="kanban-save-status"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
            Save failed.{" "}
            <button
              type="button"
              onClick={flushSave}
              className="underline underline-offset-2 ml-0.5"
            >
              Retry
            </button>
          </span>
        ) : save.isDirty ? (
          <span
            className="inline-flex items-center gap-1 text-amber-700"
            data-testid="kanban-save-status"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending changes…
          </span>
        ) : save.lastSavedAt ? (
          <span
            className="inline-flex items-center gap-1 text-emerald-700"
            data-testid="kanban-save-status"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Saved
          </span>
        ) : (
          <span data-testid="kanban-save-status">Up to date</span>
        )}

        {accuracy !== null && (
          <span
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 text-[10px] font-semibold"
            title={`Across ${accuracy.cardsCompared} completed card${accuracy.cardsCompared === 1 ? "" : "s"}, your actual time / estimate ratio is ${accuracy.ratio.toFixed(2)}. Closer to 1.0 = better calibrated.`}
            data-testid="kanban-estimate-accuracy"
          >
            ⏱ Calibration {accuracy.ratio.toFixed(2)}×
          </span>
        )}
      </div>

      {/* 4-column grid — wider gaps now that the drawer has more
          horizontal real estate (round 16 widened from 540 → 720px). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {KANBAN_COLUMNS.map((col) => {
          const meta = COLUMN_META[col];
          const cards = cardsByStatus(state, col);
          return (
            <KanbanColumn
              key={col}
              columnId={col}
              title={meta.title}
              description={meta.description}
              cards={cards}
              wipLimit={col === "doing" ? state.wipLimitDoing : undefined}
              allowAdd={meta.allowAdd}
              onAddCard={() => handleAddCard(col)}
              onCardClick={handleCardClick}
              registerColumnEl={registerColumnEl}
              draggingCardId={draggingCardId}
              hoverColumnId={hoverColumnId}
              onCardDragStart={handleCardDragStart}
              onCardDrag={handleCardDrag}
              onCardDragEnd={handleCardDragEnd}
            />
          );
        })}
      </div>

      {/* Drop toast — fires when a drag is rejected (e.g. WIP cap) */}
      {dropToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-rose-600 text-white text-[12px] font-semibold rounded-full shadow-lg flex items-center gap-2"
          role="alert"
          data-testid="kanban-drop-toast"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {dropToast}
        </div>
      )}

      {/* Round 21 — Add card modal (replaces native v1 prompt) */}
      {addCardForColumn && (
        <KanbanAddCardModal
          toStatus={addCardForColumn}
          onSubmit={handleAddCardSubmit}
          onClose={() => setAddCardForColumn(null)}
        />
      )}

      {/* Card modal */}
      {openCard && (
        <KanbanCardModal
          state={state}
          card={openCard}
          mode={modalMode}
          moveTarget={moveTarget}
          onClose={closeCardModal}
          onUpdateTitle={(title) =>
            dispatch({ type: "updateTitle", cardId: openCard.id, title })
          }
          onUpdateDoD={(dod) =>
            dispatch({ type: "updateDoD", cardId: openCard.id, dod })
          }
          onMove={(toStatus, args) => {
            // Round 23 — validate before dispatch so a WIP-blocked move
            // surfaces as a toast (same as the drag-drop "blocked"
            // path) instead of silently no-op'ing inside the reducer.
            // Round 22's softened validation means only WIP can fail
            // here, but defensive validation keeps the UX consistent
            // if FU-AG-DOD-NUDGE re-tightens things later.
            const v = validateMove(state, openCard.id, toStatus, {
              estimateMinutes: args.estimateMinutes,
              becauseClause: args.becauseClause,
            });
            if (!v.ok) {
              const wipErr = v.errors.find((e) => e.field === "wip");
              if (wipErr) {
                setDropToast(wipErr.message);
                setTimeout(() => setDropToast(null), 2400);
              }
              // Keep modal open if validation failed for any reason —
              // the student can pick a different column or close.
              return;
            }
            dispatch({
              type: "moveCard",
              cardId: openCard.id,
              toStatus,
              estimateMinutes: args.estimateMinutes,
              becauseClause: args.becauseClause,
            });
            closeCardModal();
          }}
          onMarkBlocked={(blockType: BlockType) => {
            dispatch({
              type: "markBlocked",
              cardId: openCard.id,
              blockType,
            });
            setModalMode("edit");
          }}
          onMarkUnblocked={() => {
            dispatch({ type: "markUnblocked", cardId: openCard.id });
          }}
          onDelete={() => {
            dispatch({ type: "deleteCard", cardId: openCard.id });
            closeCardModal();
          }}
          onChangeMode={(mode, target) => {
            setModalMode(mode);
            setMoveTarget(target ?? null);
          }}
        />
      )}
    </div>
  );
}
