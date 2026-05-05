"use client";

/**
 * TG.0D.3 — Tab nav strip for TaskDrawer
 *
 * 5 tabs in fixed order (GRASPS → Submission → Rubric → Timeline → Policy).
 * Each tab shows its number ("1.", "2.", ...), label, and an optional
 * error-count badge if validation errors map to that tab. The active tab
 * gets a violet underline.
 *
 * Pure rendering — all state/data comes via props. The drawer owns the
 * activeTab + errorCounts state.
 */

import {
  buildTabNavDescriptors,
  type TabNavDescriptor,
} from "./TaskDrawer.types";
import type { SummativeTabId } from "./summative-form-state";

interface TaskDrawerTabNavProps {
  activeTab: SummativeTabId;
  errorCountsByTab: Record<SummativeTabId, number>;
  onTabChange: (tab: SummativeTabId) => void;
}

export default function TaskDrawerTabNav({
  activeTab,
  errorCountsByTab,
  onTabChange,
}: TaskDrawerTabNavProps) {
  const descriptors = buildTabNavDescriptors(activeTab, errorCountsByTab);

  return (
    <div
      role="tablist"
      aria-label="Task configuration tabs"
      className="flex items-center gap-1 border-b border-[var(--le-hair)] px-3 pt-2 overflow-x-auto"
    >
      {descriptors.map((d) => (
        <TabButton
          key={d.id}
          descriptor={d}
          onSelect={() => onTabChange(d.id)}
        />
      ))}
    </div>
  );
}

function TabButton({
  descriptor: d,
  onSelect,
}: {
  descriptor: TabNavDescriptor;
  onSelect: () => void;
}) {
  const baseClasses =
    "relative flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap rounded-t transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400";
  const activeClasses = d.isActive
    ? "text-violet-700 bg-white border-b-2 border-violet-600 -mb-[2px]"
    : "text-[var(--le-ink-3)] hover:text-[var(--le-ink)] hover:bg-[var(--le-paper)]";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={d.isActive}
      aria-controls={`task-drawer-tab-panel-${d.id}`}
      data-testid={`task-drawer-tab-${d.id}`}
      data-tab-active={d.isActive ? "true" : "false"}
      onClick={onSelect}
      className={`${baseClasses} ${activeClasses}`}
    >
      <span className="text-[var(--le-ink-3)]">{d.number}.</span>
      <span>{d.label}</span>
      {d.errorCount > 0 && (
        <span
          className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9.5px] font-bold leading-none rounded-full bg-rose-600 text-white"
          aria-label={`${d.errorCount} error${d.errorCount === 1 ? "" : "s"}`}
          data-testid={`task-drawer-tab-badge-${d.id}`}
        >
          {d.errorCount}
        </span>
      )}
    </button>
  );
}
