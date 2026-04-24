"use client";

/**
 * RevisionHistoryPanel — Phase 5-5 collapsible list of prior revisions.
 *
 * Read-only for Phase 5. Students see:
 *   Revision N · Scanned · 2B · 1W · 3I · 3m ago
 *   (mini thumbnail if available)
 *
 * Phase 6's teacher queue will probably want a richer view (click-back
 * to specific revision, diff rule changes across revisions, etc). For
 * the student side in v1, this is an audit/memory aid — no navigation
 * affordances.
 *
 * Pure view — data comes via `revisions` prop (fetched once on page
 * mount). Collapsed by default when history is short; expanded when
 * the current revision > 1 so students immediately see they've had
 * multiple attempts.
 */

import * as React from "react";
import type { RevisionSummary } from "@/lib/fabrication/orchestration";
import {
  revisionStatusLabel,
  revisionStatusColorClass,
  formatRuleCountsCompact,
  formatRelativeTime,
  shouldShowHistoryPanel,
} from "./revision-history-helpers";

export interface RevisionHistoryPanelProps {
  revisions: RevisionSummary[];
  /** The current revision number — used to highlight the active row. */
  currentRevision: number;
  /** Start expanded? Defaults to auto-open when history has > 1 entries. */
  defaultOpen?: boolean;
}

export function RevisionHistoryPanel(props: RevisionHistoryPanelProps) {
  const { revisions, currentRevision } = props;
  const open = props.defaultOpen ?? shouldShowHistoryPanel(revisions);

  // Hide entirely for single-revision jobs — there's nothing to show.
  if (!shouldShowHistoryPanel(revisions)) return null;

  return (
    <details className="rounded-xl border border-gray-200 bg-white" open={open}>
      <summary className="cursor-pointer select-none p-4 text-sm font-semibold text-gray-800 flex items-center justify-between">
        <span>Your attempts ({revisions.length})</span>
        <span aria-hidden="true" className="text-gray-400 text-xs">
          click to collapse
        </span>
      </summary>
      <ul className="divide-y divide-gray-100">
        {revisions.map((r) => {
          const label = revisionStatusLabel(r.scanStatus);
          const dotClass = revisionStatusColorClass(r.scanStatus);
          const counts = formatRuleCountsCompact(r.ruleCounts);
          const when = formatRelativeTime(r.createdAt);
          const isCurrent = r.revisionNumber === currentRevision;

          return (
            <li
              key={r.id}
              className={`flex items-center gap-3 p-3 text-sm ${
                isCurrent ? "bg-brand-purple/5" : ""
              }`}
            >
              {/* Mini thumbnail */}
              {r.thumbnailUrl ? (
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  className="w-10 h-10 rounded border border-gray-200 object-contain bg-gray-50 shrink-0"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded border border-dashed border-gray-200 bg-gray-50 shrink-0"
                />
              )}

              {/* Main row */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">
                    Revision {r.revisionNumber}
                    {isCurrent && (
                      <span className="ml-1.5 text-xs font-normal text-brand-purple">
                        (current)
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${dotClass}`}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                  {counts && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                      {counts}
                    </span>
                  )}
                </div>
                {r.scanError && (
                  <p className="text-xs text-red-700 mt-0.5 line-clamp-1">
                    {r.scanError}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">{when}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default RevisionHistoryPanel;
