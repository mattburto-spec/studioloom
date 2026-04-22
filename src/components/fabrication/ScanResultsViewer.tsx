"use client";

/**
 * ScanResultsViewer — Phase 5-3 container for the soft-gate UX.
 *
 * Renders the three-bucket results layout from spec §8 plus the submit
 * + re-upload actions. Stateless / controlled — parent (5-4 status
 * page) owns ack state + wires the API calls.
 *
 * Submit enablement is driven by the `canSubmitState` prop produced by
 * canSubmit() (Phase 5-2). Same predicate the server enforces, so the
 * button state can't drift from what the submit endpoint would accept.
 */

import * as React from "react";
import { RuleCard } from "./RuleCard";
import {
  classifyRules,
  type Rule,
  type CanSubmitResult,
} from "@/lib/fabrication/rule-buckets";
import type { AckChoice, AcknowledgedWarnings } from "@/lib/fabrication/orchestration";

export interface ScanResultsViewerProps {
  scanResults: { rules?: Rule[] | null };
  acknowledgedWarnings: AcknowledgedWarnings | null;
  revisionNumber: number;
  canSubmitState: CanSubmitResult;
  onAcknowledge: (ruleId: string, choice: AckChoice) => void;
  onSubmit: () => void;
  onReupload: () => void;
  isSubmitting?: boolean;
  isAckInFlight?: boolean;
  /** Filename of the currently-displayed revision, for the header strip. */
  filename?: string;
  /** Thumbnail URL (signed) to display at the top of the viewer. */
  thumbnailUrl?: string | null;
  /** Machine profile label for the header strip. */
  machineLabel?: string;
  /** Drives the fileType-aware ack option labels (STL: slicer, SVG:
   *  design software). Defaults to 'stl' — page should always pass. */
  fileType?: "stl" | "svg";
  /** Phase 6-2: teacher-side read-only view. When true: Submit +
   *  Re-upload buttons + gate explainer are hidden, radios show the
   *  student's choices but can't be changed, empty-state hint labels
   *  flip from "ready to submit" to "student saw no issues". */
  readOnly?: boolean;
  /** Phase 6-6c: hide ONLY the Submit button (keep Re-upload visible
   *  + interactive). Used on the student-side status page when the
   *  job is in `needs_revision` or `pending_approval` — Submit is
   *  inappropriate (teacher asked for a fix / already submitted) but
   *  re-uploading a new revision is still the valid next step.
   *  Caller derives via shouldHideSubmitButton(jobStatus). Ignored
   *  when readOnly is true (that hides both anyway). */
  hideSubmit?: boolean;
}

export function ScanResultsViewer(props: ScanResultsViewerProps) {
  const {
    scanResults,
    acknowledgedWarnings,
    revisionNumber,
    canSubmitState,
    onAcknowledge,
    onSubmit,
    onReupload,
    isSubmitting = false,
    isAckInFlight = false,
    filename,
    thumbnailUrl,
    machineLabel,
    fileType = "stl",
    readOnly = false,
    hideSubmit = false,
  } = props;

  const buckets = classifyRules(scanResults);
  const revisionKey = `revision_${revisionNumber}`;
  const acksForRevision = acknowledgedWarnings?.[revisionKey] ?? {};

  const disabledFromAction = isSubmitting || isAckInFlight;

  return (
    <div className="space-y-6">
      {/* Header strip — thumbnail + file metadata */}
      {(filename || thumbnailUrl || machineLabel) && (
        <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4">
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt="Scan preview"
              className="w-40 h-40 rounded-lg border border-gray-200 object-contain bg-gray-50 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            {filename && (
              <h2 className="text-sm font-semibold text-gray-900 truncate">
                {filename}
              </h2>
            )}
            <div className="text-xs text-gray-500 mt-0.5 space-x-1.5">
              {machineLabel && <span>{machineLabel}</span>}
              {machineLabel && <span aria-hidden="true">·</span>}
              <span>Revision {revisionNumber}</span>
            </div>
          </div>
        </div>
      )}

      {/* Must-fix bucket */}
      {buckets.mustFix.length > 0 && (
        <section aria-labelledby="mustfix-heading" className="space-y-3">
          <h2
            id="mustfix-heading"
            className="text-sm font-bold text-red-900 uppercase tracking-wide"
          >
            🛑 {buckets.mustFix.length} must fix
          </h2>
          {buckets.mustFix.map((rule) => (
            <RuleCard key={rule.id} rule={rule} disabled={disabledFromAction} />
          ))}
          <p className="text-xs text-red-800 italic">
            These must be resolved in the file — re-upload a fixed version before
            submitting.
          </p>
        </section>
      )}

      {/* Should-fix bucket */}
      {buckets.shouldFix.length > 0 && (
        <section aria-labelledby="shouldfix-heading" className="space-y-3">
          <h2
            id="shouldfix-heading"
            className="text-sm font-bold text-amber-900 uppercase tracking-wide"
          >
            ⚠️ {buckets.shouldFix.length} should fix — acknowledge each
          </h2>
          {buckets.shouldFix.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              currentChoice={acksForRevision[rule.id]?.choice}
              onAcknowledge={onAcknowledge}
              disabled={disabledFromAction}
              fileType={fileType}
              readOnly={readOnly}
            />
          ))}
        </section>
      )}

      {/* FYI bucket */}
      {buckets.fyi.length > 0 && (
        <section aria-labelledby="fyi-heading" className="space-y-3">
          <h2
            id="fyi-heading"
            className="text-sm font-bold text-gray-700 uppercase tracking-wide"
          >
            ℹ️ {buckets.fyi.length} FYI
          </h2>
          {buckets.fyi.map((rule) => (
            <RuleCard key={rule.id} rule={rule} disabled={disabledFromAction} />
          ))}
        </section>
      )}

      {/* Empty state — no rules fired at all */}
      {buckets.mustFix.length === 0 &&
        buckets.shouldFix.length === 0 &&
        buckets.fyi.length === 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            {readOnly
              ? "Scan passed with no rules fired — clean submission."
              : "No issues found. Your file is ready to submit."}
          </div>
        )}

      {/* Submit + Re-upload actions (hidden in teacher readOnly view).
          When hideSubmit is set (jobStatus = needs_revision or
          pending_approval — see shouldHideSubmitButton), Submit is
          omitted and Re-upload becomes the primary purple action. */}
      {!readOnly && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!hideSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmitState.ok || disabledFromAction}
                className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting…" : "Submit for approval"}
              </button>
            )}
            <button
              type="button"
              onClick={onReupload}
              disabled={disabledFromAction}
              className={
                hideSubmit
                  ? "flex-1 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  : "flex-1 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              }
            >
              Re-upload a fixed version
            </button>
          </div>

          {/* Gate-failure explainer (student-only, pre-submit only) */}
          {!hideSubmit && !canSubmitState.ok && canSubmitState.reason && (
            <p role="status" className="text-xs text-gray-600 italic">
              {canSubmitState.reason === "blockers_present"
                ? "Submit is disabled until all must-fix issues are resolved in a re-uploaded version."
                : "Submit is disabled until every should-fix warning has an acknowledgement above."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default ScanResultsViewer;
