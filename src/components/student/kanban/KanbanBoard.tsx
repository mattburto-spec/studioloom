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

import { useState } from "react";
import {
  KANBAN_COLUMNS,
  type KanbanColumn as KanbanColumnId,
  type BlockType,
} from "@/lib/unit-tools/kanban/types";
import {
  cardsByStatus,
  estimateAccuracy,
} from "@/lib/unit-tools/kanban/reducer";
import KanbanColumn from "./KanbanColumn";
import KanbanCardModal, { type ModalMode } from "./KanbanCardModal";
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
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("edit");
  const [moveTarget, setMoveTarget] = useState<KanbanColumnId | null>(null);

  function openCardModal(cardId: string, mode: ModalMode = "edit") {
    setOpenCardId(cardId);
    setModalMode(mode);
    setMoveTarget(null);
  }

  function closeCardModal() {
    setOpenCardId(null);
    setMoveTarget(null);
  }

  function handleAddCard(toStatus: KanbanColumnId) {
    const title = window.prompt("Card title:");
    if (!title?.trim()) return;
    dispatch({ type: "createCard", title, status: toStatus });
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

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="kanban-board"
      data-unit-id={unitId}
    >
      {/* Save indicator */}
      <div className="flex items-center gap-2 text-[10.5px] text-gray-500 px-1">
        <span className="font-semibold uppercase tracking-wide">
          Project board
        </span>
        <span className="text-gray-300">·</span>
        {save.isSaving ? (
          <span data-testid="kanban-save-status">Saving...</span>
        ) : save.error ? (
          <span className="text-rose-600" data-testid="kanban-save-status">
            Save failed.{" "}
            <button
              type="button"
              onClick={flushSave}
              className="underline underline-offset-2"
            >
              Retry
            </button>
          </span>
        ) : save.isDirty ? (
          <span data-testid="kanban-save-status">Pending changes...</span>
        ) : save.lastSavedAt ? (
          <span data-testid="kanban-save-status">Saved</span>
        ) : (
          <span data-testid="kanban-save-status">Up to date</span>
        )}

        {accuracy !== null && (
          <>
            <span className="text-gray-300">·</span>
            <span
              className="ml-auto"
              title={`Across ${accuracy.cardsCompared} completed card${accuracy.cardsCompared === 1 ? "" : "s"}, your actual time / estimate ratio is ${accuracy.ratio.toFixed(2)}. Closer to 1.0 = better calibrated.`}
              data-testid="kanban-estimate-accuracy"
            >
              ⏱ Estimate calibration: {accuracy.ratio.toFixed(2)}× ({accuracy.cardsCompared}{" "}
              card{accuracy.cardsCompared === 1 ? "" : "s"})
            </span>
          </>
        )}
      </div>

      {/* 4-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
              onCardClick={(cardId) => openCardModal(cardId)}
            />
          );
        })}
      </div>

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
