"use client";

/**
 * AG.2.3b — KanbanCard
 *
 * Single-card render. Click → opens detail modal (parent owns).
 * Pure presentation — all state lives in KanbanBoard's reducer.
 *
 * Visual signals:
 *   - Title (bold)
 *   - DoD chip (when set, gray pill)
 *   - Time estimate badge (⏱ 25m) when set
 *   - Blocked indicator (rose dot + block-type label) when blocked
 *   - Lesson link icon when card is lesson-attached
 *   - Source badge (📔) for journal-next cards
 *
 * Per Lesson #71: zero pure logic in this file — everything formattable
 * comes from the card object directly. Tests stay in reducer + helpers.
 */

import type { KanbanCard as KanbanCardType } from "@/lib/unit-tools/kanban/types";

interface KanbanCardProps {
  card: KanbanCardType;
  onClick: () => void;
}

const BLOCK_LABELS: Record<NonNullable<KanbanCardType["blockType"]>, string> = {
  tool: "Tool",
  skill: "Skill",
  decision: "Decision",
  help: "Help",
};

export default function KanbanCard({ card, onClick }: KanbanCardProps) {
  const isBlocked = card.blockType !== null;
  const isJournalCreated = card.source === "journal_next";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left p-2 rounded-md border transition-shadow",
        "bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
        isBlocked
          ? "border-rose-300 ring-1 ring-rose-100"
          : "border-gray-200 hover:border-violet-300",
      ].join(" ")}
      data-testid={`kanban-card-${card.id}`}
      data-card-status={card.status}
      data-card-blocked={isBlocked ? "true" : "false"}
    >
      <div className="flex items-start gap-1.5">
        {isJournalCreated && (
          <span
            className="text-[11px] mt-0.5 flex-shrink-0"
            title="Created from journal Next prompt"
            aria-label="From journal"
          >
            📔
          </span>
        )}
        {card.lessonLink && (
          <span
            className="text-[11px] mt-0.5 flex-shrink-0"
            title="Linked to a lesson activity"
            aria-label="Linked to lesson"
          >
            🔗
          </span>
        )}
        <span className="flex-1 text-[12px] font-semibold text-gray-900 leading-snug break-words">
          {card.title}
        </span>
      </div>

      {/* Meta line — DoD, estimate, blocked */}
      <div className="mt-1.5 flex items-center flex-wrap gap-1 text-[10px]">
        {card.dod && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 max-w-full"
            title={card.dod}
          >
            <span className="mr-0.5">✓</span>
            <span className="truncate" style={{ maxWidth: "10rem" }}>
              {card.dod}
            </span>
          </span>
        )}
        {card.estimateMinutes !== null && card.estimateMinutes > 0 && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-50 text-violet-700"
            title={
              card.actualMinutes !== null
                ? `Estimate ${card.estimateMinutes}m / Actual ${card.actualMinutes}m`
                : `Estimated ${card.estimateMinutes}m`
            }
          >
            ⏱ {card.estimateMinutes}m
            {card.actualMinutes !== null && (
              <span className="ml-0.5 text-gray-600">
                /{card.actualMinutes}m
              </span>
            )}
          </span>
        )}
        {isBlocked && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
            <span className="w-1 h-1 rounded-full bg-rose-500 mr-1" />
            Blocked: {BLOCK_LABELS[card.blockType!]}
          </span>
        )}
      </div>
    </button>
  );
}
