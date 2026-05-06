"use client";

/**
 * KanbanCard — single-card render. Click → opens detail modal.
 *
 * Round 16 — visual hierarchy + status-coded border + blocked pill
 * Round 19 — drag-to-move lives on the parent KanbanColumn's
 *   motion.div wrapper (it already owns the layout animation).
 *   Putting drag here would nest two motion components and they'd
 *   fight each other's transforms. KanbanCard stays a plain
 *   button + delegates "did the user actually drag" via
 *   isDraggingRef + onClickGuarded.
 */

import type { KanbanCard as KanbanCardType } from "@/lib/unit-tools/kanban/types";

interface KanbanCardProps {
  card: KanbanCardType;
  onClick: () => void;
  /**
   * Round 19 — when true, suppress click (the pointer-up after a
   * drag fires a synthetic click; the column's drag controller
   * sets this flag so the modal doesn't open mid-drop).
   */
  suppressClick?: boolean;
  /**
   * Round 19 — set when this card is the one currently being
   * dragged. Adds a tiny grab cursor + slight visual lift hint.
   */
  isDragging?: boolean;
}

const BLOCK_LABELS: Record<NonNullable<KanbanCardType["blockType"]>, string> = {
  tool: "Tool",
  skill: "Skill",
  decision: "Decision",
  help: "Help",
};

const BLOCK_ICONS: Record<NonNullable<KanbanCardType["blockType"]>, string> = {
  tool: "🔧",
  skill: "🧠",
  decision: "🤔",
  help: "🙋",
};

// Status → subtle left border colour. Matches the column accents in
// KanbanColumn.tsx.
const STATUS_BORDER: Record<KanbanCardType["status"], string> = {
  backlog: "border-l-slate-400",
  this_class: "border-l-amber-500",
  doing: "border-l-violet-500",
  done: "border-l-emerald-500",
};

export default function KanbanCard({
  card,
  onClick,
  suppressClick,
  isDragging,
}: KanbanCardProps) {
  const isBlocked = card.blockType !== null;
  const isJournalCreated = card.source === "journal_next";
  const statusBorder = STATUS_BORDER[card.status];

  function handleClick(e: React.MouseEvent) {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        "group w-full text-left p-2.5 pl-3 rounded-lg border-l-[3px] border-y border-r",
        "bg-white transition-shadow duration-200",
        "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
        "cursor-grab active:cursor-grabbing",
        isDragging ? "shadow-2xl" : "",
        statusBorder,
        isBlocked
          ? "border-y-rose-300 border-r-rose-300 bg-rose-50/40"
          : "border-y-gray-200 border-r-gray-200 hover:border-y-gray-300 hover:border-r-gray-300",
      ].join(" ")}
      data-testid={`kanban-card-${card.id}`}
      data-card-status={card.status}
      data-card-blocked={isBlocked ? "true" : "false"}
      data-card-dragging={isDragging ? "true" : "false"}
    >
      {/* Title row — icons left, title right */}
      <div className="flex items-start gap-1.5">
        {isJournalCreated && (
          <span
            className="text-[12px] mt-0.5 flex-shrink-0 opacity-70"
            title="Created from journal Next prompt"
            aria-label="From journal"
          >
            📔
          </span>
        )}
        {card.lessonLink && (
          <span
            className="text-[12px] mt-0.5 flex-shrink-0 opacity-60"
            title="Linked to a lesson activity"
            aria-label="Linked to lesson"
          >
            🔗
          </span>
        )}
        <span className="flex-1 text-[13px] font-bold text-gray-900 leading-snug break-words">
          {card.title}
        </span>
      </div>

      {/* Meta line — DoD, estimate, blocked. Only renders when there
          IS something to show, so simple cards don't have a wasted
          empty row. */}
      {(card.dod ||
        (card.estimateMinutes !== null && card.estimateMinutes > 0) ||
        isBlocked) && (
        <div className="mt-2 flex items-center flex-wrap gap-1.5 text-[10.5px]">
          {card.dod && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-700 max-w-full"
              title={card.dod}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1 text-emerald-600 flex-shrink-0"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="truncate" style={{ maxWidth: "9rem" }}>
                {card.dod}
              </span>
            </span>
          )}
          {card.estimateMinutes !== null && card.estimateMinutes > 0 && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-800 font-semibold tabular-nums"
              title={
                card.actualMinutes !== null
                  ? `Estimate ${card.estimateMinutes}m / Actual ${card.actualMinutes}m`
                  : `Estimated ${card.estimateMinutes}m`
              }
            >
              ⏱ {card.estimateMinutes}m
              {card.actualMinutes !== null && (
                <span className="text-violet-500 font-normal">
                  /{card.actualMinutes}m
                </span>
              )}
            </span>
          )}
          {isBlocked && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 font-semibold">
              <span className="text-[11px]" aria-hidden="true">
                {BLOCK_ICONS[card.blockType!]}
              </span>
              {BLOCK_LABELS[card.blockType!]}
            </span>
          )}
        </div>
      )}

      {/* Done card — surface the becauseClause as a small pinned quote */}
      {card.status === "done" && card.becauseClause && (
        <div
          className="mt-2 pt-2 border-t border-emerald-100 text-[10.5px] text-emerald-900 italic leading-snug truncate"
          title={card.becauseClause}
        >
          &ldquo;{card.becauseClause}&rdquo;
        </div>
      )}
    </button>
  );
}
