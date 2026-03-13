"use client";

import { getPageColor } from "@/lib/constants";
import type { PageDueDatesMap, UnitPage } from "@/types";

interface DueDateDisplayProps {
  /** The current page ID (e.g. "A1", "B3") */
  currentPageId: string;
  /** Map of page IDs to due date strings */
  pageDueDates?: PageDueDatesMap;
  /** Overall unit final due date */
  finalDueDate?: string | null;
  /** The current page data */
  currentPage?: UnitPage;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDays(days: number): { text: string; className: string } {
  if (days > 1)
    return { text: `${days} days left`, className: "text-text-primary font-medium" };
  if (days === 1)
    return { text: "Due tomorrow", className: "text-amber-600 font-semibold" };
  if (days === 0)
    return { text: "Due today", className: "text-amber-600 font-semibold" };
  return {
    text: `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`,
    className: "text-red-500 font-semibold",
  };
}

export function DueDateDisplay({
  currentPageId,
  pageDueDates,
  finalDueDate,
  currentPage,
}: DueDateDisplayProps) {
  const currentPageDue = pageDueDates?.[currentPageId];
  const finalDays = finalDueDate ? daysUntil(finalDueDate) : null;
  const currentDays = currentPageDue ? daysUntil(currentPageDue) : null;

  const pageColor = currentPage ? getPageColor(currentPage) : "#6B7280";

  // Check if there's anything to display
  if (!currentPageDue && finalDays === null) return null;

  return (
    <div className="flex items-center gap-4 bg-white rounded-lg border border-border px-4 py-2 text-sm">
      {/* Current page due date */}
      {currentDays !== null && (
        <div className="flex items-center gap-1.5">
          <span
            className="font-semibold text-xs px-1.5 py-0.5 rounded"
            style={{
              color: pageColor,
              backgroundColor: pageColor + "15",
            }}
          >
            {currentPageId}
          </span>
          <span className={`text-xs ${formatDays(currentDays).className}`}>
            {formatDays(currentDays).text}
          </span>
        </div>
      )}

      {/* Separator */}
      {currentDays !== null && finalDays !== null && (
        <div className="w-px h-4 bg-border" />
      )}

      {/* Final due */}
      {finalDays !== null && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-secondary text-xs">Final:</span>
          <span className={`text-xs ${formatDays(finalDays).className}`}>
            {formatDays(finalDays).text}
          </span>
        </div>
      )}
    </div>
  );
}
