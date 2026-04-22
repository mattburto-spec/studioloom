"use client";

/**
 * ScanProgressCard — Phase 4-5 view component for the student status
 * page. Pure view: takes a FabricationPollState + elapsed message, no
 * data fetching. The page wires useFabricationStatus + feeds the card.
 *
 * Five visual states mapped directly from the poll state machine:
 *   idle / polling → animated progress card with staged message
 *   done           → success card with thumbnail + rule-count summary
 *   error          → red error card with scan_error text + retry link
 *   timeout        → amber "come back later" card
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

  // state.kind === "done"
  const rev = state.status.revision;
  const rulesJson = rev?.scanRulesetVersion ?? "unknown";
  // The scan_results JSONB isn't exposed on the status payload (4-2
  // deliberately kept it thin); rule count is an enhancement for Phase 5
  // once the results viewer lands. For now we show the ruleset version +
  // thumbnail + a link placeholder.
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6">
      <div className="flex items-start gap-4">
        {rev?.thumbnailUrl && (
          <img
            src={rev.thumbnailUrl}
            alt="Scan preview"
            className="w-24 h-24 rounded-lg border border-green-300 object-contain bg-white"
          />
        )}
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-green-900">
            Scan complete
          </h2>
          <p className="text-sm text-green-800 mt-1">
            Your file has been checked with ruleset {rulesJson}.
          </p>
          <p className="text-xs text-green-700 mt-2">
            Detailed results viewer coming soon. Your submission is safely
            stored for your teacher to review.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/fabrication/new"
              className="text-sm font-semibold text-green-900 underline"
            >
              Submit another file →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanProgressCard;
