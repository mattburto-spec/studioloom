"use client";

import { useState, useMemo } from "react";
// Inline SVG icons (project does NOT use lucide-react — Lesson Learned #16)
const IconProps = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ChevronDown = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><path d="M6 9l6 6 6-6" /></svg>
);
const ChevronUp = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><path d="M18 15l-6-6-6 6" /></svg>
);
const AlertTriangle = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);
const AlertCircle = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);
const ClockIcon = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);
const TypeIcon = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
);
const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
);
const EyeIcon = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
);
const RotateCwIcon = ({ className }: { className?: string }) => (
  <svg {...IconProps} className={className}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
);
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";
import {
  analyzeIntegrity,
  getScoreColor,
  getScoreBgColor,
  getScoreLabel,
} from "@/lib/integrity/analyze-integrity";
import type { IntegrityAnalysis, IntegrityFlag } from "@/lib/integrity/analyze-integrity";
import { stripResponseHtml } from "@/lib/integrity/strip-response-html";

interface IntegrityReportProps {
  metadata: IntegrityMetadata;
  studentName?: string;
  responseText?: string;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}m ${secs}s`;
}

function formatRelativeTimestamp(ms: number, startMs: number): string {
  const totalSeconds = Math.floor((ms - startMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Teacher Integrity Report — displays integrity analysis of a student's response.
 * Shows score badge, activity metrics, flags, writing playback slider, and paste log.
 */
export default function IntegrityReport({
  metadata,
  studentName,
  responseText,
}: IntegrityReportProps) {
  const [expandedPasteLog, setExpandedPasteLog] = useState(false);
  const [snapshotIndex, setSnapshotIndex] = useState(
    Math.max(0, metadata.snapshots.length - 1)
  );

  const analysis = useMemo(() => analyzeIntegrity(metadata), [metadata]);

  const currentSnapshot = useMemo(() => {
    // stripResponseHtml: student responses may contain auto-injected vocabulary
    // "Look up <word>" buttons + RichTextEditor formatting markup. Strip to
    // plain prose so the teacher sees the actual writing, not the markup.
    if (metadata.snapshots.length === 0) {
      return {
        text: stripResponseHtml(responseText),
        timestamp: metadata.startTime,
      };
    }
    const snap = metadata.snapshots[snapshotIndex];
    return { text: stripResponseHtml(snap.text), timestamp: snap.timestamp };
  }, [snapshotIndex, metadata.snapshots, metadata.startTime, responseText]);

  const deletionRate = useMemo(() => {
    if (metadata.keystrokeCount === 0) return 0;
    return Math.round((metadata.deletionCount / metadata.keystrokeCount) * 100);
  }, [metadata.keystrokeCount, metadata.deletionCount]);

  const hasSnapshots = metadata.snapshots.length > 0;
  const hasPastes = metadata.pasteEvents.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      {studentName && (
        <div className="pb-2">
          <p className="text-sm text-gray-600">
            Integrity Report for{" "}
            <span className="font-semibold">{studentName}</span>
          </p>
        </div>
      )}

      {/* Score Badge + Summary Stats Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Score Badge */}
        <div
          className={`flex flex-col items-center justify-center rounded-lg border p-6 ${getScoreBgColor(analysis.score)}`}
          style={{ minWidth: "140px" }}
        >
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full border-4 ${
              analysis.score >= 70
                ? "border-green-300 bg-green-100"
                : analysis.score >= 40
                  ? "border-amber-300 bg-amber-100"
                  : "border-red-300 bg-red-100"
            }`}
          >
            <span className={`text-3xl font-bold ${getScoreColor(analysis.score)}`}>
              {analysis.score}
            </span>
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-gray-700">
            {getScoreLabel(analysis.level)}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-800">Activity Metrics</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-gray-600">
                <ClockIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Time Active</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {formatTime(metadata.totalTimeActive)}
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-gray-600">
                <TypeIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Keystrokes</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {metadata.keystrokeCount.toLocaleString()}
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-gray-600">
                <ClipboardIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Pastes</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {metadata.pasteEvents.length}
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-gray-600">
                <EyeIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Focus Losses</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {metadata.focusLossCount}
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-gray-600">
                <RotateCwIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Deletion Rate</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {deletionRate}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Flags Section */}
      {analysis.flags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">Integrity Flags</h3>
          <div className="space-y-2">
            {analysis.flags.map((flag, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-3 ${
                  flag.severity === "concern"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex gap-2">
                  {flag.severity === "concern" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-semibold ${
                        flag.severity === "concern" ? "text-red-700" : "text-amber-700"
                      }`}
                    >
                      {flag.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="mt-1 text-xs text-gray-700">{flag.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Writing Playback Slider */}
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Writing Playback</h3>
          {hasSnapshots && (
            <p className="text-xs text-gray-500">
              {snapshotIndex + 1} / {metadata.snapshots.length}
            </p>
          )}
        </div>

        {hasSnapshots ? (
          <>
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max={Math.max(0, metadata.snapshots.length - 1)}
                value={snapshotIndex}
                onChange={(e) => setSnapshotIndex(parseInt(e.target.value))}
                className="h-2 w-full cursor-pointer rounded-lg bg-gray-200 accent-blue-600"
              />
            </div>

            <p className="mb-3 text-right text-xs font-medium text-gray-600">
              {formatRelativeTimestamp(currentSnapshot.timestamp, metadata.startTime)}
            </p>

            <textarea
              readOnly
              value={currentSnapshot.text}
              className="h-48 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 font-mono"
            />

            <div className="mt-3 flex gap-4 border-t border-gray-200 pt-3">
              <div className="flex-1">
                <p className="text-xs text-gray-500">Word Count</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {currentSnapshot.text.trim().split(/\s+/).filter(Boolean).length}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Character Count</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {currentSnapshot.text.length}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">
            No snapshots captured
          </p>
        )}
      </div>

      {/* Paste Log */}
      {hasPastes && (
        <div className="rounded-lg border border-border bg-white p-4">
          <button
            onClick={() => setExpandedPasteLog(!expandedPasteLog)}
            className="flex w-full items-center justify-between py-2 hover:bg-gray-50 rounded"
          >
            <h3 className="text-sm font-semibold text-gray-800">
              Paste Log ({metadata.pasteEvents.length})
            </h3>
            {expandedPasteLog ? (
              <ChevronUp className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {expandedPasteLog && (
            <div className="space-y-2 border-t border-gray-200 pt-3">
              {metadata.pasteEvents.map((paste, idx) => (
                <div key={idx} className="rounded-lg bg-gray-50 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium text-gray-700">
                      {formatRelativeTimestamp(paste.timestamp, metadata.startTime)}
                    </p>
                    <p className="text-gray-500">{paste.length} characters</p>
                  </div>
                  <p className="font-mono text-gray-600 break-words">
                    {paste.content}
                    {paste.length > 100 ? "..." : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
