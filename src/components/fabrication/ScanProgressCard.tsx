"use client";

/**
 * ScanProgressCard — Phase 4-5 view component for the student status
 * page, narrowed in Phase 5-3.
 *
 * Four visual states (done-state dropped — ScanResultsViewer owns it now):
 *   idle / polling → animated progress card with staged message
 *   error          → red error card with scan_error text + retry link
 *   timeout        → amber "come back later" card
 *
 * When called with state.kind === 'done', returns null (defensive — the
 * caller should have delegated to ScanResultsViewer before reaching here).
 */

import * as React from "react";
import Link from "next/link";
import type { FabricationPollState } from "@/lib/fabrication/status-poll-state";
import { selectStagedMessage } from "@/lib/fabrication/status-poll-state";

export interface ScanProgressCardProps {
  state: FabricationPollState;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec}s`;
}

export function ScanProgressCard({ state }: ScanProgressCardProps) {
  if (state.kind === "idle" || state.kind === "polling") {
    const scanStatus =
      state.kind === "polling" ? state.status.revision?.scanStatus ?? null : null;
    const message = selectStagedMessage({ scanStatus, elapsedMs: state.elapsedMs });
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{message}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatElapsed(state.elapsedMs)} elapsed
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6"
      >
        <h2 className="text-sm font-semibold text-red-900 mb-1">
          Something went wrong during the scan
        </h2>
        <p className="text-sm text-red-800">{state.message}</p>
        <Link
          href="/fabrication/new"
          className="inline-block mt-4 text-sm font-semibold text-red-900 underline"
        >
          Try uploading again →
        </Link>
      </div>
    );
  }

  if (state.kind === "timeout") {
    return (
      <div
        role="status"
        className="rounded-xl border border-amber-200 bg-amber-50 p-6"
      >
        <h2 className="text-sm font-semibold text-amber-900 mb-1">
          Still working on it…
        </h2>
        <p className="text-sm text-amber-800">
          Scanning is taking longer than expected. We&apos;ve saved your file —
          come back in a few minutes and check this page again.
        </p>
      </div>
    );
  }

  // state.kind === "done" — Phase 5-3 ScanResultsViewer now owns this
  // state. The status page delegates to ScanResultsViewer before reaching
  // ScanProgressCard. Returning null here is defensive: if a caller still
  // passes a done state to this component (legacy code path, test), we
  // render nothing rather than the stale "Scan complete" card.
  return null;
}

export default ScanProgressCard;
