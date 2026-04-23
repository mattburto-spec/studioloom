"use client";

/**
 * TeacherQueueTabs — Phase 6-3 status-tab switcher.
 *
 * Controlled component. Parent owns the active tab + counts; this
 * component just renders the bar and announces clicks. Tab keys match
 * `teacher-queue-helpers.ts` — change there, change here.
 *
 * Count badges render even at 0 so the teacher sees "Pending approval (0)"
 * instead of the label jumping when the first submission arrives —
 * predictable layout wins over saved pixels.
 */

import * as React from "react";
import {
  QUEUE_TABS,
  tabLabel,
  type QueueTab,
} from "./teacher-queue-helpers";

export interface TeacherQueueTabsProps {
  activeTab: QueueTab;
  counts: Record<QueueTab, number>;
  onChange: (tab: QueueTab) => void;
}

export function TeacherQueueTabs({
  activeTab,
  counts,
  onChange,
}: TeacherQueueTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Fabrication queue tabs"
      className="flex flex-wrap gap-1 border-b border-gray-200"
    >
      {QUEUE_TABS.map((tab) => {
        const isActive = tab === activeTab;
        const count = counts[tab];
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={[
              "relative px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-all active:scale-[0.97]",
              isActive
                ? "border-brand-purple text-brand-purple"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300",
            ].join(" ")}
          >
            <span>{tabLabel(tab)}</span>
            <span
              className={[
                "ml-2 inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-semibold",
                isActive
                  ? "bg-brand-purple/10 text-brand-purple"
                  : "bg-gray-100 text-gray-700",
              ].join(" ")}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default TeacherQueueTabs;
