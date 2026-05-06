"use client";

/**
 * KanbanColumn — single-column container.
 *
 * Round 16 (6 May 2026) UI overhaul:
 *   - Per-column color scheme (subtle tint matches the column's role)
 *   - Framer Motion AnimatePresence for card add/remove + layout for
 *     position transitions when cards move between columns
 *   - WIP slot indicator on Doing — empty slot vs filled slot vs over
 *   - Larger empty-state copy with clearer call-to-action
 *
 * Round 19 (6 May 2026) — drag-and-drop:
 *   - Each card's wrapper motion.div now carries `drag` props
 *   - Column outer div registers itself with the board via columnRef
 *     callback so the board can hit-test pointer position on drop
 *   - Visual: drop-zone highlight + glow when a draggable card is
 *     hovered over us mid-drag
 */

import { useRef, useEffect } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
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
  /**
   * Round 19 — drag-and-drop hooks. The board passes:
   *   - registerColumnEl: cb to capture this column's DOM node so
   *     it can read the column rect for hit-testing on drop
   *   - draggingCardId: which card is currently being dragged
   *     (null when no drag is active)
   *   - hoverColumnId: which column the dragged card is currently
   *     over — drives the drop-zone highlight
   *   - onCardDragStart / onCardDrag / onCardDragEnd: lifecycle
   *     callbacks bubbled from each card's motion.div
   */
  registerColumnEl?: (id: KanbanColumnId, el: HTMLElement | null) => void;
  draggingCardId?: string | null;
  hoverColumnId?: KanbanColumnId | null;
  onCardDragStart?: (cardId: string) => void;
  onCardDrag?: (cardId: string, info: PanInfo) => void;
  onCardDragEnd?: (cardId: string, info: PanInfo) => void;
  /**
   * Round 23 (6 May 2026 PM) — when true, the next click on any card
   * is swallowed. Set by the board for ~250ms after a drag-end so the
   * synthetic pointer-up click on the dragged card doesn't open the
   * detail modal. Same pattern as the "+ Add card" ghost-click guard.
   */
  suppressCardClick?: boolean;
}

/**
 * Per-column tone. Kept intentionally subtle — the cards are the
 * primary visual; columns are the spatial frame.
 */
const COLUMN_TONE: Record<
  KanbanColumnId,
  {
    bg: string; // column background
    border: string; // column border
    accent: string; // header dot color
    label: string; // header label color
  }
> = {
  backlog: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    accent: "bg-slate-500",
    label: "text-slate-700",
  },
  this_class: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    accent: "bg-amber-500",
    label: "text-amber-800",
  },
  doing: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    accent: "bg-violet-500",
    label: "text-violet-800",
  },
  done: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    accent: "bg-emerald-500",
    label: "text-emerald-800",
  },
};

const EMPTY_STATE: Record<KanbanColumnId, string> = {
  backlog: "Add cards as you plan.",
  this_class: "Pull from Backlog when ready to commit.",
  doing: "Move one card here when you start working on it.",
  done: "Cards land here when you finish.",
};

export default function KanbanColumn({
  columnId,
  title,
  description,
  cards,
  wipLimit,
  allowAdd,
  onAddCard,
  onCardClick,
  registerColumnEl,
  draggingCardId,
  hoverColumnId,
  onCardDragStart,
  onCardDrag,
  onCardDragEnd,
  suppressCardClick,
}: KanbanColumnProps) {
  const count = cards.length;
  const overLimit = wipLimit !== undefined && count > wipLimit;
  const atLimit = wipLimit !== undefined && count === wipLimit;
  const tone = COLUMN_TONE[columnId];

  // Round 19 — register our DOM node with the board so it can read
  // our rect during pointer hit-testing.
  const elRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (registerColumnEl) registerColumnEl(columnId, elRef.current);
    return () => {
      if (registerColumnEl) registerColumnEl(columnId, null);
    };
  }, [columnId, registerColumnEl]);

  // Highlight when the dragged card is hovered over THIS column AND
  // it isn't where the card already lives.
  const isDropTarget =
    draggingCardId !== null &&
    draggingCardId !== undefined &&
    hoverColumnId === columnId;
  const draggedCard = cards.find((c) => c.id === draggingCardId) ?? null;
  const isOriginColumn = draggedCard !== null;

  return (
    <div
      ref={elRef}
      className={[
        `flex flex-col rounded-xl border ${tone.bg} ${tone.border} p-3 min-w-0 min-h-[14rem] transition-all duration-150`,
        // Drop-target glow — only when a foreign card is hovering
        isDropTarget && !isOriginColumn
          ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-white"
          : "",
      ].join(" ")}
      data-testid={`kanban-column-${columnId}`}
      data-is-drop-target={isDropTarget && !isOriginColumn ? "true" : "false"}
    >
      {/* Header — accent dot + title + count */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-block w-2 h-2 rounded-full ${tone.accent}`}
            aria-hidden="true"
          />
          <h3
            className={`text-[11.5px] font-extrabold uppercase tracking-wider ${tone.label}`}
          >
            {title}
          </h3>
          <span
            className={[
              "text-[11px] tabular-nums px-1.5 py-0.5 rounded-full",
              overLimit
                ? "bg-rose-600 text-white font-bold"
                : atLimit
                ? "bg-amber-500 text-white font-semibold"
                : "bg-white/70 text-gray-700 font-semibold",
            ].join(" ")}
            data-testid={`kanban-column-${columnId}-count`}
          >
            {wipLimit !== undefined ? `${count}/${wipLimit}` : count}
          </span>
        </div>
      </div>

      <p className="text-[10.5px] text-gray-600 mb-2.5 leading-tight">
        {description}
      </p>

      {/* Cards — Framer Motion layout group so reflows animate when
          cards move between columns. */}
      <div className="flex-1 space-y-2 min-h-[3rem]">
        <AnimatePresence initial={false} mode="popLayout">
          {cards.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-[11px] text-gray-500 italic text-center py-6 px-2 leading-snug"
              data-testid={`kanban-column-${columnId}-empty`}
            >
              {EMPTY_STATE[columnId]}
            </motion.div>
          ) : (
            cards.map((card) => {
              const isThisDragging = draggingCardId === card.id;
              return (
                <motion.div
                  key={card.id}
                  layout={!isThisDragging /* don't fight the drag */}
                  layoutId={`kanban-card-${card.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 28,
                    mass: 0.8,
                  }}
                  // Round 19 — drag prop. Only enabled when the
                  // board provides drag callbacks (omitted in tests
                  // / preview).
                  drag={!!onCardDragEnd}
                  dragSnapToOrigin
                  dragMomentum={false}
                  dragElastic={0.18}
                  whileDrag={{
                    scale: 1.04,
                    rotate: -1.2,
                    zIndex: 50,
                  }}
                  onDragStart={() => onCardDragStart?.(card.id)}
                  onDrag={(_e, info: PanInfo) => onCardDrag?.(card.id, info)}
                  onDragEnd={(_e, info: PanInfo) =>
                    onCardDragEnd?.(card.id, info)
                  }
                  style={{
                    // Subtle dim on non-dragging cards while a drag
                    // is in progress, to focus the eye.
                    opacity:
                      draggingCardId !== null && draggingCardId !== card.id
                        ? 0.55
                        : 1,
                  }}
                >
                  <KanbanCard
                    card={card}
                    onClick={() => onCardClick(card.id)}
                    isDragging={isThisDragging}
                    suppressClick={suppressCardClick}
                  />
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Add card affordance */}
      {allowAdd && (
        <button
          type="button"
          onClick={onAddCard}
          className={`mt-2.5 text-[11.5px] text-gray-500 hover:${tone.label} hover:bg-white border border-dashed border-gray-300 hover:border-current rounded-lg px-2.5 py-1.5 transition-all duration-150 font-semibold`}
          data-testid={`kanban-column-${columnId}-add`}
        >
          + Add card
        </button>
      )}
    </div>
  );
}
