"use client";

/**
 * AG.2.3b — KanbanColumn
 *
 * Renders one column header + the cards within. WIP indicator on the
 * Doing column shows current count vs limit (e.g. "1 / 1") with rose
 * tint when at limit. "+ Add" affordance only on Backlog and This Class
 * (Doing requires moving cards from earlier columns; Done is auto).
 */

import type {
  KanbanCard as KanbanCardType,
  KanbanColumn as KanbanColumnId,
} from "@/lib/unit-tools/kanban/types";
import KanbanCard from "./KanbanCard";

interface KanbanColumnProps {
  columnId: KanbanColumnId;
  title: string;
  description: string;
  cards: KanbanCardType[];
  /** Only set on the Doing column. */
  wipLimit?: number;
  /** Whether to show the "+ Add card" affordance. */
  allowAdd: boolean;
  onAddCard: () => void;
  onCardClick: (cardId: string) => void;
}

export default function KanbanColumn({
  columnId,
  title,
  description,
  cards,
  wipLimit,
  allowAdd,
  onAddCard,
  onCardClick,
}: KanbanColumnProps) {
  const count = cards.length;
  const overLimit = wipLimit !== undefined && count > wipLimit;
  const atLimit = wipLimit !== undefined && count === wipLimit;

  return (
    <div
      className="flex flex-col bg-gray-50 rounded-lg border border-gray-200 p-2 min-w-0"
      data-testid={`kanban-column-${columnId}`}
    >
      {/* Column header */}
      <div className="flex items-baseline justify-between mb-1.5 px-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-gray-700">
            {title}
          </h3>
          <span
            className={[
              "text-[10.5px] tabular-nums",
              overLimit
                ? "text-rose-600 font-bold"
                : atLimit
                  ? "text-amber-600 font-semibold"
                  : "text-gray-500",
            ].join(" ")}
            data-testid={`kanban-column-${columnId}-count`}
          >
            {wipLimit !== undefined
              ? `${count} / ${wipLimit}`
              : `${count}`}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 px-1 mb-1.5 leading-tight">
        {description}
      </p>

      {/* Cards */}
      <div className="flex-1 space-y-1.5 min-h-[2rem]">
        {cards.length === 0 && (
          <div className="text-[10.5px] text-gray-400 italic text-center py-3 px-1">
            {columnId === "backlog"
              ? "Empty. Add cards as you plan."
              : columnId === "this_class"
                ? "Pull from Backlog when ready to commit."
                : columnId === "doing"
                  ? "Move one card here when you start working on it."
                  : "Cards land here when you finish."}
          </div>
        )}
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onClick={() => onCardClick(card.id)}
          />
        ))}
      </div>

      {/* Add card affordance */}
      {allowAdd && (
        <button
          type="button"
          onClick={onAddCard}
          className="mt-1.5 text-[11px] text-gray-500 hover:text-violet-700 hover:bg-white border border-dashed border-gray-300 hover:border-violet-300 rounded px-2 py-1 transition-colors"
          data-testid={`kanban-column-${columnId}-add`}
        >
          + Add card
        </button>
      )}
    </div>
  );
}
