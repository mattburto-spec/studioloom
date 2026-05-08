"use client";

/**
 * TeacherQueueTable — Phase 6-3 queue row renderer.
 *
 * Click anywhere on a row → `/teacher/preflight/jobs/[jobId]` detail
 * page (Phase 6-2). No inline action buttons in v1 — the detail page
 * is the single surface for approve / return / reject. Keeps the
 * "first look before acting" safety in Phase 6-2 §10 Q5.
 *
 * Column layout (desktop, school-laptop target):
 *   Thumb │ Student · Class │ Unit │ Machine │ Rev · Rules │ Waiting
 *
 * On narrow widths the table falls back to a single-column card list
 * (mobile polish is Phase 9, but the layout shouldn't look broken).
 */

import * as React from "react";
import Link from "next/link";
import type { QueueRow } from "@/lib/fabrication/teacher-orchestration";
import {
  formatRuleCountsCompact,
  formatRelativeTime,
  formatDateTime,
} from "./revision-history-helpers";
import { shouldFlagRevisionCount } from "./teacher-queue-helpers";

export interface TeacherQueueTableProps {
  rows: QueueRow[];
  emptyMessage: string;
  /** Phase 8.1d-16: when set, each row gets a checkbox in the
   *  leading column and the click target on the row body still
   *  goes to the detail page. Caller manages the selected-id set
   *  + the toggle handler. */
  selection?: {
    selectedIds: Set<string>;
    onToggle: (jobId: string) => void;
    onToggleAll: () => void;
    /** Subset of rows that are currently eligible for selection
     *  (e.g. just `pending_approval` rows). Used to drive the
     *  master checkbox's checked/indeterminate state. */
    selectableIds: Set<string>;
  };
}

export function TeacherQueueTable({
  rows,
  emptyMessage,
  selection,
}: TeacherQueueTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-600">{emptyMessage}</p>
      </div>
    );
  }

  // Master checkbox state — checked when ALL selectable rows are
  // selected, indeterminate when SOME, unchecked when none.
  const masterRef = React.useRef<HTMLInputElement>(null);
  const selectableCount = selection?.selectableIds.size ?? 0;
  const selectedCount = selection
    ? Array.from(selection.selectedIds).filter((id) =>
        selection.selectableIds.has(id)
      ).length
    : 0;
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const someSelected = selectedCount > 0 && selectedCount < selectableCount;

  React.useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = someSelected;
  }, [someSelected]);

  // Grid template adjusts when selection is on — adds a leading
  // 32px checkbox column.
  const desktopGridCols = selection
    ? "md:grid-cols-[32px_72px_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto]"
    : "md:grid-cols-[72px_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto]";

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header row — desktop only. Mobile renders as cards. */}
      <div
        className={`hidden md:grid ${desktopGridCols} gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500`}
      >
        {selection && (
          <div className="flex items-center justify-center">
            <input
              ref={masterRef}
              type="checkbox"
              checked={allSelected}
              onChange={selection.onToggleAll}
              disabled={selectableCount === 0}
              aria-label={
                allSelected
                  ? "Deselect all"
                  : someSelected
                    ? "Select all (currently partial)"
                    : "Select all"
              }
              className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple/30 disabled:opacity-30"
            />
          </div>
        )}
        <div aria-hidden="true" />
        <div>Student</div>
        <div>Unit / File</div>
        <div>Machine</div>
        <div className="text-center">Revision</div>
        <div className="text-right">Waiting</div>
      </div>

      <ul className="divide-y divide-gray-100">
        {rows.map((row) => (
          <QueueRowItem key={row.jobId} row={row} selection={selection} />
        ))}
      </ul>
    </div>
  );
}

function QueueRowItem({
  row,
  selection,
}: {
  row: QueueRow;
  selection?: TeacherQueueTableProps["selection"];
}) {
  const ruleCounts = formatRuleCountsCompact(row.ruleCounts);
  const waiting = formatRelativeTime(row.createdAt);
  const absoluteWaiting = formatDateTime(row.createdAt);
  const flagRev = shouldFlagRevisionCount(row.currentRevision);
  const statusPill = statusPillClass(row.jobStatus);
  const isSelectable = selection?.selectableIds.has(row.jobId) ?? false;
  const isSelected = selection?.selectedIds.has(row.jobId) ?? false;
  const desktopGridCols = selection
    ? "md:grid-cols-[32px_72px_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto]"
    : "md:grid-cols-[72px_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto]";

  return (
    <li className={isSelected ? "bg-brand-purple/5" : ""}>
      <div className="relative">
        {/* Phase 8.1d-16: when selection is on, the checkbox sits OUTSIDE
             the link wrapper so a click on it doesn't navigate to the
             detail page. The link covers the rest of the row. */}
        {selection && (
          <div className="absolute left-4 top-0 bottom-0 hidden md:flex items-center z-10">
            <input
              type="checkbox"
              checked={isSelected}
              disabled={!isSelectable}
              onChange={() => selection.onToggle(row.jobId)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${row.studentName}'s submission`}
              className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple/30 disabled:opacity-30 disabled:cursor-not-allowed"
              title={
                isSelectable
                  ? "Select for batch action"
                  : "Only pending-approval rows can be batch-actioned"
              }
            />
          </div>
        )}
      <Link
        href={`/teacher/preflight/jobs/${row.jobId}`}
        className="block hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30"
      >
        {/* Desktop row */}
        <div className={`hidden md:grid ${desktopGridCols} gap-4 items-center px-4 py-3`}>
          {selection && <div aria-hidden="true" />}
          {/* Thumbnail */}
          <div className="w-14 h-14 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {row.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.thumbnailUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <span aria-hidden="true" className="text-gray-300 text-xs">
                —
              </span>
            )}
          </div>

          {/* Student + class + status pill */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">
                {row.studentName}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${statusPill}`}
              >
                {row.jobStatus.replace(/_/g, " ")}
              </span>
              {row.pilotOverrideAt && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300"
                  title={`Student used Pilot Mode override on ${row.pilotOverrideRuleIds.join(", ") || "block rule(s)"}. Worth a review before approving.`}
                >
                  ⚠ Override ({row.pilotOverrideRuleIds.length})
                </span>
              )}
            </div>
            {row.className && (
              <p className="text-xs text-gray-500 truncate">{row.className}</p>
            )}
          </div>

          {/* Unit / File */}
          <div className="min-w-0">
            {row.unitTitle ? (
              <p className="text-sm text-gray-800 truncate">{row.unitTitle}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No unit linked</p>
            )}
            <p className="text-xs text-gray-500 font-mono truncate">
              {row.originalFilename}
            </p>
          </div>

          {/* Machine */}
          <div className="min-w-0">
            <p className="text-sm text-gray-800 truncate">{row.machineLabel}</p>
            {row.machineCategory && (
              <p className="text-xs text-gray-500">
                {row.machineCategory.replace(/_/g, " ")}
              </p>
            )}
          </div>

          {/* Revision + rule counts stacked */}
          <div className="flex flex-col items-center gap-1 min-w-[4.5rem]">
            <span
              className={`text-xs font-semibold ${
                flagRev ? "text-red-700" : "text-gray-700"
              }`}
              title={flagRev ? "3+ attempts — student may need help" : undefined}
            >
              Rev {row.currentRevision}
              {flagRev && (
                <span aria-hidden="true" className="ml-0.5">
                  ⚠
                </span>
              )}
            </span>
            {ruleCounts ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono whitespace-nowrap">
                {ruleCounts}
              </span>
            ) : (
              <span className="text-xs text-green-700">clean</span>
            )}
          </div>

          {/* Time waiting — relative on top, absolute below for
               longer-waiting rows where "2d ago" loses precision. */}
          <div className="text-xs whitespace-nowrap text-right">
            <div className="text-gray-500">{waiting}</div>
            <div className="text-gray-400 text-[11px] mt-0.5 font-mono">
              {absoluteWaiting}
            </div>
          </div>
        </div>

        {/* Mobile card */}
        <div className="md:hidden p-3 flex gap-3 items-start">
          <div className="w-12 h-12 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {row.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.thumbnailUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <span aria-hidden="true" className="text-gray-300 text-xs">
                —
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">
                {row.studentName}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${statusPill}`}
              >
                {row.jobStatus.replace(/_/g, " ")}
              </span>
              {row.pilotOverrideAt && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300"
                  title={`Override on ${row.pilotOverrideRuleIds.join(", ") || "block rule(s)"}`}
                >
                  ⚠ Override ({row.pilotOverrideRuleIds.length})
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 truncate">
              {row.machineLabel}
              {row.className && ` · ${row.className}`}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className={flagRev ? "text-red-700 font-semibold" : ""}>
                Rev {row.currentRevision}
                {flagRev && " ⚠"}
              </span>
              {ruleCounts && (
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                  {ruleCounts}
                </span>
              )}
              <span>· {waiting}</span>
              <span className="font-mono text-gray-400">· {absoluteWaiting}</span>
            </div>
          </div>
        </div>
      </Link>
      </div>
    </li>
  );
}

/**
 * Same tint family as the detail-page pill (keeps the row + detail page
 * visually consistent). Separate copy rather than a shared import —
 * Phase 6-2 keeps this inline in page.tsx and we don't want a circular
 * dependency pulling the page file into a component.
 */
function statusPillClass(status: string): string {
  switch (status) {
    case "approved":
    case "completed":
      return "bg-green-100 text-green-900";
    case "pending_approval":
      return "bg-amber-100 text-amber-900";
    case "needs_revision":
      return "bg-orange-100 text-orange-900";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-900";
    case "uploaded":
    case "scanning":
      return "bg-blue-100 text-blue-900";
    case "picked_up":
      return "bg-purple-100 text-purple-900";
    default:
      return "bg-gray-100 text-gray-900";
  }
}

export default TeacherQueueTable;
