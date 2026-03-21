"use client";

import React from "react";
import Link from "next/link";

interface DueItem {
  unitId: string;
  unitTitle: string;
  pageId: string;
  pageTitle: string;
  dueDate: string; // ISO string
  isOverdue: boolean;
  isComplete: boolean;
}

interface DueThisWeekProps {
  items: DueItem[];
}

/**
 * Compact widget showing upcoming page due dates.
 * Shows up to 5 items. Overdue items highlighted in amber/red.
 * Complete items shown with a green checkmark.
 */
export function DueThisWeek({ items }: DueThisWeekProps) {
  if (items.length === 0) return null;

  // Sort: overdue + incomplete first, then by date
  const sorted = [...items].sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const visible = sorted.slice(0, 5);

  function formatDueDate(iso: string, overdue: boolean): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (overdue) {
      const overdueDays = Math.abs(diffDays);
      return overdueDays === 0 ? "Due today" : overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`;
    }
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return `Due ${date.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200/60 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-100/60 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Due Soon</span>
      </div>
      <div className="divide-y divide-gray-100">
        {visible.map((item) => (
          <Link
            key={`${item.unitId}-${item.pageId}`}
            href={`/unit/${item.unitId}/${item.pageId}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/50 transition-colors group"
          >
            {/* Status indicator */}
            {item.isComplete ? (
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#10B981">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
            ) : item.isOverdue ? (
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3">
                  <path d="M12 9v4M12 17h.01" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-amber-300 flex-shrink-0" />
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${item.isComplete ? "text-gray-400 line-through" : "text-gray-800 group-hover:text-purple-600"}`}>
                {item.pageTitle}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{item.unitTitle}</p>
            </div>

            {/* Due label */}
            <span
              className={`text-[10px] font-semibold whitespace-nowrap px-2 py-0.5 rounded-full ${
                item.isComplete
                  ? "text-green-600 bg-green-50"
                  : item.isOverdue
                    ? "text-red-600 bg-red-50"
                    : "text-amber-600 bg-amber-50"
              }`}
            >
              {item.isComplete ? "Done" : formatDueDate(item.dueDate, item.isOverdue)}
            </span>
          </Link>
        ))}
      </div>
      {items.length > 5 && (
        <div className="px-4 py-2 border-t border-gray-100 text-center">
          <span className="text-xs text-gray-400">+{items.length - 5} more</span>
        </div>
      )}
    </div>
  );
}
