"use client";

/**
 * UploadProgress — Phase 4-4. Renders the upload state machine's visual
 * feedback. Pure view component — all state comes in via props from the
 * page's useReducer. Handles:
 *   - determinate bar (XHR reports lengthComputable progress events)
 *   - indeterminate spinner (events not firing — fallback per brief §5)
 *   - enqueuing stage (bar complete, secondary "queueing scan" message)
 *   - error display
 */

import * as React from "react";
import type { UploadState } from "./upload-state";
import { uploadProgressPercent } from "./upload-state";
import { formatFileSize } from "./picker-helpers";

export interface UploadProgressProps {
  state: UploadState;
}

export function UploadProgress({ state }: UploadProgressProps) {
  if (state.kind === "idle" || state.kind === "done") return null;

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4"
      >
        <p className="text-sm font-semibold text-red-900">Upload failed</p>
        <p className="text-sm text-red-800 mt-1">{state.message}</p>
      </div>
    );
  }

  // uploading or enqueuing
  const percent = uploadProgressPercent(state);
  const isIndeterminate = state.kind === "uploading" && percent === null;
  const isEnqueuing = state.kind === "enqueuing";

  const label = isEnqueuing
    ? "Queueing your file for scanning…"
    : state.kind === "uploading" && state.indeterminate
    ? "Uploading…"
    : state.kind === "uploading"
    ? `Uploading — ${formatFileSize(state.loaded)} of ${formatFileSize(state.total)}`
    : "Uploading…";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3 mb-2">
        {isIndeterminate && (
          <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        )}
        <p className="text-sm font-medium text-gray-800">{label}</p>
      </div>
      <div
        className="h-2 rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-valuenow={percent ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {isIndeterminate || isEnqueuing ? (
          <div className="h-full w-full bg-brand-purple opacity-40 animate-pulse" />
        ) : (
          <div
            className="h-full bg-brand-purple transition-all duration-200"
            style={{ width: `${percent ?? 0}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default UploadProgress;
